// Planner (§15) + Task Graph (§16): goal -> DAG. No browser/computer nodes.
import type { ProductSpec } from "@platform/spec";

export interface PlanNode {
  key: string;
  label: string;
  tool: "web-research" | "normalize" | "codegen-landing" | "codegen-webapp" | "codegen-android" | "spreadsheet" | "pdf-report" | "scaffold" | "install" | "build" | "package" | "verify";
  dependsOn: string[];
  parallel?: boolean;
}

export interface Plan { goal: string; nodes: PlanNode[]; spec?: ProductSpec; }

export function buildPlanForGoal(goal: string): Plan {
  const g = goal.toLowerCase();
  const wantsApp = /app|android|apk|expo|website|landing|webapp|site/.test(g);
  const wantsSheet = /spreadsheet|xlsx|excel|csv|pricing|competitor|compare/.test(g);
  const wantsPdf = /pdf|report|analysis/.test(g);

  const nodes: PlanNode[] = [
    { key: "research", label: "Fetch-only web research", tool: "web-research", dependsOn: [] },
    { key: "normalize", label: "Normalize findings", tool: "normalize", dependsOn: ["research"] }
  ];
  if (wantsSheet) nodes.push({ key: "spreadsheet", label: "Create spreadsheet", tool: "spreadsheet", dependsOn: ["normalize"] });
  if (wantsApp) {
    if (/android|apk/.test(g)) nodes.push({ key: "android", label: "Scaffold Android app", tool: "codegen-android", dependsOn: ["normalize"] });
    else if (/landing/.test(g)) nodes.push({ key: "landing", label: "Generate landing page", tool: "codegen-landing", dependsOn: ["normalize"] });
    else nodes.push({ key: "webapp", label: "Scaffold web app", tool: "codegen-webapp", dependsOn: ["normalize"] });
  }
  if (wantsPdf) nodes.push({ key: "report", label: "Generate PDF report", tool: "pdf-report", dependsOn: wantsSheet ? ["spreadsheet"] : ["normalize"] });
  nodes.push({ key: "verify", label: "Verify artifacts", tool: "verify", dependsOn: nodes.filter(n => !["research","normalize"].includes(n.key)).map(n => n.key) });
  return { goal, nodes };
}

// Quality-gated product pipeline: scaffold -> install -> build -> package -> verify.
// Every product node chain ends in build-green + verify before COMPLETED.
export function planFromSpec(spec: ProductSpec): Plan {
  const kind = spec.productType === "expo" ? "Expo app" : spec.productType === "webapp" ? "Web app" : "Landing page";
  return {
    goal: `Build ${kind}: ${spec.name}`,
    spec,
    nodes: [
      { key: "scaffold", label: `Scaffold ${kind} (${spec.screens.length} screens)`, tool: "scaffold", dependsOn: [] },
      { key: "install", label: "Install dependencies", tool: "install", dependsOn: ["scaffold"] },
      { key: "build", label: "Build (must pass)", tool: "build", dependsOn: ["install"] },
      { key: "package", label: "Package + manifest", tool: "package", dependsOn: ["build"] },
      { key: "verify", label: "Verify artifacts", tool: "verify", dependsOn: ["package"] }
    ]
  };
}

// Topological order; throws on cycles.
export function orderNodes(plan: Plan): PlanNode[] {
  const byKey = new Map(plan.nodes.map(n => [n.key, n]));
  const visited = new Set<string>();
  const out: PlanNode[] = [];
  function visit(key: string, stack: string[]) {
    if (visited.has(key)) return;
    if (stack.includes(key)) throw new Error(`Cycle in plan: ${[...stack, key].join(" -> ")}`);
    const node = byKey.get(key);
    if (!node) throw new Error(`Unknown dependency: ${key}`);
    for (const dep of node.dependsOn) visit(dep, [...stack, key]);
    visited.add(key);
    out.push(node);
  }
  for (const n of plan.nodes) visit(n.key, []);
  return out;
}
