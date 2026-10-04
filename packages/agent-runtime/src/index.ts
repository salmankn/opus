// Agent Runtime (§14): THINK->PLAN->ACT->OBSERVE->VERIFY->RECOVER->DELIVER.
// No browser/computer tools. Controlled workers only. Bounded by $0 quotas.
import { buildPlanForGoal, orderNodes, planFromSpec } from "@platform/planner";
import { routeModel } from "@platform/models";
import { runTool } from "@platform/tools";
import { verifyResearch, verifyArtifacts, verifyProduct } from "@platform/verification";
import { classify, shouldRetry } from "@platform/recovery";
import { buildCsv, buildLanding, buildReport, scaffoldSpec, packageProduct, TEMPLATE_VERSIONS } from "@platform/codegen";
import { runProductBuild, type BuildResult } from "@platform/sandbox";
import { specFromGoal, type ProductSpec } from "@platform/spec";

export type AgentEvent = { type: string; data?: unknown };
export type Emitter = (e: AgentEvent) => void;

const MAX_TOOLS = Number(process.env.TASK_MAX_TOOL_CALLS ?? 50);

export async function runTask(goal: string, emit: Emitter = () => {}): Promise<{ artifacts: string[]; summary: string }> {
  emit({ type: "TASK_STARTED", data: { goal } });
  const plan = buildPlanForGoal(goal);
  emit({ type: "PLAN_CREATED", data: { nodes: plan.nodes.map(n => n.key), route: routeModel("planning") } });
  const ordered = orderNodes(plan);

  const artifacts: string[] = [];
  let toolCalls = 0;
  let researchSources: { query: string; snippet: string }[] = [];

  for (const node of ordered) {
    emit({ type: "STEP_STARTED", data: { key: node.key } });
    let attempts = 0;
    for (;;) {
      try {
        if (++toolCalls > MAX_TOOLS) throw new Error("tool budget exceeded (free-tier guardrail)");
        if (node.tool === "web-research") {
          emit({ type: "TOOL_STARTED", data: { tool: "web-research" } });
          const out = await runTool("web-research", { queries: [goal.slice(0, 120), `${goal.slice(0, 60)} pricing features`] });
          researchSources = (out as { sources: { query: string; snippet: string }[] }).sources;
          emit({ type: "OBSERVATION_CREATED", data: { count: researchSources.length } });
          const v = verifyResearch(researchSources);
          if (!v.pass) throw new Error(`verification failed: ${v.checks[0]?.detail}`);
          emit({ type: "TOOL_COMPLETED", data: { tool: "web-research" } });
        } else if (node.tool === "spreadsheet") {
          const rows = researchSources.slice(0, 10).map((s, i) => ({ rank: String(i + 1), query: s.query, excerpt: s.snippet.slice(0, 120) }));
          const b = await buildCsv("demo-task", "competitor-analysis", rows.length ? rows : [{ note: "no sources" }]);
          artifacts.push(b.key);
        } else if (node.tool === "codegen-landing") {
          const b = await buildLanding("demo-task", goal.slice(0, 80), researchSources.slice(0, 5).map(s => s.snippet.slice(0, 140)));
          artifacts.push(b.key);
        } else if (node.tool === "pdf-report") {
          const b = await buildReport("demo-task", "Market analysis", researchSources.slice(0, 5).map(s => `- ${s.snippet.slice(0, 200)}`).join("\n") || "No sources collected.");
          artifacts.push(b.key);
        } else if (node.tool === "verify") {
          emit({ type: "VERIFICATION_STARTED" });
          const v = await verifyArtifacts(artifacts);
          if (!v.pass && artifacts.length > 0) throw new Error("artifact verification failed");
          emit({ type: "VERIFICATION_PASSED" });
        }
        // normalize / codegen-webapp / codegen-android handled by worker extensions; noop here
        emit({ type: "STEP_COMPLETED", data: { key: node.key } });
        break;
      } catch (err) {
        const kind = classify(err);
        attempts++;
        if (!shouldRetry(kind, attempts)) {
          emit({ type: "TASK_FAILED", data: { key: node.key, kind, error: String((err as Error).message).slice(0, 300) } });
          throw err;
        }
      }
    }
  }

  emit({ type: "TASK_COMPLETED", data: { artifacts } });
  return { artifacts, summary: `Completed ${ordered.length} steps, ${artifacts.length} artifacts (fetch-only, no browser control).` };
}

// Quality-gated product pipeline (P4): scaffold -> build (bounded fix loop) -> package -> verify.
// Build MUST be green before COMPLETED; red after retries => throws TASK_FAILED.
export async function runProductTask(
  specOrGoal: ProductSpec | string,
  emit: Emitter = () => {},
  taskId?: string
): Promise<{ taskId: string; artifacts: string[]; summary: string; buildMs: number }> {
  const spec: ProductSpec = typeof specOrGoal === "string" ? specFromGoal(specOrGoal) : specOrGoal;
  const tid = taskId ?? `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  const maxAttempts = Number(process.env.TASK_MAX_RETRIES ?? 3);

  emit({ type: "TASK_STARTED", data: { goal: `Build ${spec.productType}: ${spec.name}`, taskId: tid } });
  const plan = planFromSpec(spec);
  emit({ type: "PLAN_CREATED", data: { nodes: plan.nodes.map(n => n.key), route: routeModel("coding"), spec } });

  emit({ type: "STEP_STARTED", data: { key: "scaffold" } });
  const built = await scaffoldSpec(spec, tid);
  emit({ type: "STEP_COMPLETED", data: { key: "scaffold", files: built.length } });

  emit({ type: "STEP_STARTED", data: { key: "build" } });
  let build: BuildResult | null = null;
  let attempt = 0;
  for (;;) {
    attempt++;
    emit({ type: "BUILD_STARTED", data: { attempt, of: maxAttempts } });
    build = await runProductBuild(tid, spec.productType);
    if (build.pass) {
      emit({ type: "BUILD_PASSED", data: { ms: build.ms } });
      break;
    }
    emit({ type: "BUILD_FAILED", data: { attempt, log: build.log.slice(-1000) } });
    const kind = classify(new Error(build.log.slice(-200) || "build failed"));
    if (!shouldRetry(kind === "unknown" ? "tool-failure" : kind, attempt, maxAttempts)) break;
    // Re-scaffold (deterministic templates) then rebuild — clears transient install states.
    await scaffoldSpec(spec, tid);
  }
  emit({ type: "STEP_COMPLETED", data: { key: "build", pass: build.pass } });
  if (!build.pass) {
    emit({ type: "TASK_FAILED", data: { key: "build", kind: "verification-failure", error: build.log.slice(-500) } });
    throw new Error(`Build did not pass after ${attempt} attempt(s): ${build.log.slice(-300)}`);
  }

  emit({ type: "STEP_STARTED", data: { key: "package" } });
  const pkg = await packageProduct(tid, spec, built, build.log, TEMPLATE_VERSIONS[spec.productType]);
  emit({ type: "STEP_COMPLETED", data: { key: "package", zip: pkg.zipKey } });

  emit({ type: "VERIFICATION_STARTED" });
  const rels = built.map(b => b.key.slice(`${tid}/product/`.length));
  const verdict = await verifyProduct(`${tid}/product`, spec.productType, rels, build);
  if (!verdict.pass) {
    emit({ type: "TASK_FAILED", data: { key: "verify", failed: verdict.checks.filter(c => !c.pass) } });
    throw new Error(`Verification failed: ${verdict.checks.filter(c => !c.pass).map(c => `${c.name}: ${c.detail}`).join("; ").slice(0, 400)}`);
  }
  emit({ type: "VERIFICATION_PASSED", data: { checks: verdict.checks.length } });

  const artifacts = [...built.map(b => b.key), pkg.manifestKey, pkg.zipKey];
  emit({ type: "TASK_COMPLETED", data: { artifacts } });
  return { taskId: tid, artifacts, summary: `${spec.productType} '${spec.name}' built green in ${build.ms}ms, ${built.length} files packaged.`, buildMs: build.ms };
}
