import { NextResponse } from "next/server";
import { ProductSpecSchema, specFromGoal } from "@platform/spec";
import { runProductTask } from "@platform/agent-runtime";
import { storageRoot } from "@platform/storage";
import { readFile } from "node:fs/promises";

export const runtime = "nodejs";
export const maxDuration = 600;

// POST { spec } or { goal } -> scaffold -> build (must pass) -> package -> verify.
export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  if (!json) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  let spec;
  if (json.spec) {
    const parsed = ProductSpecSchema.safeParse(json.spec);
    if (!parsed.success) return NextResponse.json({ error: "Invalid spec", issues: parsed.error.issues.slice(0, 5) }, { status: 400 });
    spec = parsed.data;
  } else if (typeof json.goal === "string" && json.goal.trim().length >= 3) {
    spec = specFromGoal(json.goal);
  } else {
    return NextResponse.json({ error: "Provide { spec } or { goal }" }, { status: 400 });
  }

  const events: { type: string; at: string }[] = [];
  try {
    const result = await runProductTask(spec, (e) => { events.push({ type: e.type, at: new Date().toISOString() }); });
    const manifestKey = result.artifacts.find((a) => a.endsWith("/product.json"));
    const manifest = manifestKey
      ? JSON.parse(await readFile(`${storageRoot()}/${manifestKey}`, "utf8"))
      : null;
    return NextResponse.json({
      taskId: result.taskId,
      summary: result.summary,
      buildMs: result.buildMs,
      artifacts: result.artifacts.map((a) => ({ key: a, url: `/api/artifacts/${a}` })),
      deploy: manifest?.deliver ?? null,
      events: events.map((e) => e.type)
    });
  } catch (err) {
    return NextResponse.json({ error: String((err as Error).message).slice(0, 500), events: events.map((e) => e.type) }, { status: 422 });
  }
}
