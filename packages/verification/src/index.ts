// Verification Engine (§28): never trust model claims — check real outputs.
import { artifactExists } from "@platform/storage";

export interface Check { name: string; pass: boolean; detail: string; }
export interface Verdict { pass: boolean; checks: Check[]; }

export async function verifyArtifacts(keys: string[], opts?: { minBytes?: number }): Promise<Verdict> {
  const checks: Check[] = [];
  if (keys.length === 0) return { pass: false, checks: [{ name: "artifacts-present", pass: false, detail: "no artifacts produced" }] };
  for (const key of keys) {
    const exists = await artifactExists(key).catch(() => false);
    checks.push({ name: `exists:${key}`, pass: exists, detail: exists ? "found" : "missing" });
  }
  return { pass: checks.every(c => c.pass), checks };
}

export function verifyResearch(sources: { snippet: string }[], minSources = 2): Verdict {
  const ok = sources.filter(s => s.snippet && s.snippet.length > 50);
  const pass = ok.length >= minSources;
  return { pass, checks: [{ name: "sources-collected", pass, detail: `${ok.length}/${sources.length} usable (min ${minSources})` }] };
}

// Product gates (P5): build MUST be green — nothing ships on red.
import type { BuildResult } from "@platform/sandbox";
import { getArtifact } from "@platform/storage";

const REQUIRED: Record<string, string[]> = {
  landing: ["index.html"],
  webapp: ["package.json", "tsconfig.json", "next.config.js", "app/layout.tsx", "app/page.tsx"],
  expo: ["package.json", "app.json", "tsconfig.json", "App.tsx"]
};

const STUB_MARKERS = ["TODO", "FIXME", "lorem ipsum"];

export async function verifyProduct(
  prefix: string,
  productType: "landing" | "webapp" | "expo",
  files: string[],
  build: BuildResult
): Promise<Verdict> {
  const checks: Check[] = [
    { name: "build-green", pass: build.pass, detail: build.pass ? `exit 0 (${build.ms}ms)` : `exit ${build.exitCode}: ${build.log.slice(-300)}` }
  ];
  for (const req of REQUIRED[productType] ?? []) {
    const ok = files.some(f => f === req || f.endsWith(`/${req}`));
    checks.push({ name: `required:${req}`, pass: ok, detail: ok ? "present" : "missing" });
  }
  for (const key of files.filter(f => /\.(tsx|ts|html)$/.test(f))) {
    try {
      const text = (await getArtifact(`${prefix}/${key}`)).toString("utf8");
      const hit = STUB_MARKERS.find(m => text.includes(m));
      if (text.length < 50) checks.push({ name: `content:${key}`, pass: false, detail: "file too small" });
      else if (hit) checks.push({ name: `content:${key}`, pass: false, detail: `stub marker: ${hit}` });
      if (productType === "expo" && key.endsWith("app.json")) {
        try {
          const j = JSON.parse(text);
          if (!j.expo?.name || !j.expo?.slug) checks.push({ name: "expo-config", pass: false, detail: "app.json missing expo.name/slug" });
          else checks.push({ name: "expo-config", pass: true, detail: `${j.expo.slug}` });
        } catch { checks.push({ name: "expo-config", pass: false, detail: "app.json invalid JSON" }); }
      }
    } catch { checks.push({ name: `content:${key}`, pass: false, detail: "unreadable" }); }
  }
  return { pass: checks.every(c => c.pass), checks };
}
