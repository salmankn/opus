// Sandbox build runner (P3): process-isolated, no Docker required ($0).
// Builds EXACTLY what scaffoldSpec shipped: storage-local/<taskId>/product.
// Allowlisted commands only; timeouts enforced; secrets redacted from logs.
// Landing: static checks (no npm). Webapp/Expo: npm install + npm run build.
import { spawn } from "node:child_process";
import { stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { storageRoot } from "@platform/storage";

export interface BuildResult {
  pass: boolean;
  exitCode: number | null;
  timedOut: boolean;
  log: string;
  ms: number;
}

function storeRoot(): string {
  return storageRoot();
}

export function workdirFor(taskId: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9-_]{0,80}$/.test(taskId)) throw new Error(`Unsafe taskId: ${taskId}`);
  return join(storeRoot(), taskId, "product");
}

function redact(log: string): string {
  return log
    .replace(/sk-[A-Za-z0-9-_]{8,}/g, "[redacted]")
    .replace(/(api[_-]?key\s*[:=]\s*)['"]?[^'"\s]{8,}/gi, "$1[redacted]")
    .replace(/(xox[bap]-)[A-Za-z0-9-]+/g, "$1[redacted]");
}

function runCmd(cmd: string, cwd: string, timeoutMs: number): Promise<{ exit: number | null; timedOut: boolean; out: string; ms: number }> {
  return new Promise((resolveP) => {
    const started = Date.now();
    // Fixed allowlisted commands only — no user input interpolated.
    const child = spawn(cmd, { cwd, shell: true, env: { ...process.env, CI: "1", FORCE_COLOR: "0", NPM_CONFIG_AUDIT: "false", NPM_CONFIG_FUND: "false" } });
    let out = "";
    child.stdout?.on("data", (d) => { out += String(d); });
    child.stderr?.on("data", (d) => { out += String(d); });
    const timer = setTimeout(() => { child.kill("SIGKILL"); }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      resolveP({ exit: null, timedOut: false, out: `spawn error: ${(err as Error).message}`, ms: Date.now() - started });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const killed = Date.now() - started >= timeoutMs;
      resolveP({ exit: code, timedOut: killed && code !== 0, out: out.slice(-6000), ms: Date.now() - started });
    });
  });
}

async function staticCheckLanding(cwd: string): Promise<BuildResult> {
  const started = Date.now();
  try {
    const html = await readFile(join(cwd, "index.html"), "utf8");
    const checks: string[] = [];
    if (html.length < 200) checks.push("index.html too small");
    if (/<script\s+src="https?:/i.test(html)) checks.push("external script src blocked (must be self-contained)");
    if (!/<h1>/i.test(html)) checks.push("missing <h1>");
    if (checks.length) return { pass: false, exitCode: 1, timedOut: false, log: `static check failed:\n- ${checks.join("\n- ")}`, ms: Date.now() - started };
    return { pass: true, exitCode: 0, timedOut: false, log: `static check passed (${html.length} bytes, self-contained)`, ms: Date.now() - started };
  } catch (e) {
    return { pass: false, exitCode: 1, timedOut: false, log: `static check failed: ${(e as Error).message}`, ms: Date.now() - started };
  }
}

export async function runProductBuild(taskId: string, productType: "landing" | "webapp" | "expo"): Promise<BuildResult> {
  const cwd = workdirFor(taskId);
  try {
    await stat(join(cwd, productType === "landing" ? "index.html" : "package.json"));
  } catch {
    return { pass: false, exitCode: 1, timedOut: false, log: `scaffold missing in ${cwd}`, ms: 0 };
  }
  if (productType === "landing") return staticCheckLanding(cwd);

  const installTimeout = Number(process.env.BUILD_INSTALL_TIMEOUT_MS ?? 300000);
  const buildTimeout = Number(process.env.BUILD_TIMEOUT_MS ?? 180000);
  const install = await runCmd("npm install --no-audit --no-fund", cwd, installTimeout);
  if (install.exit !== 0) {
    return { pass: false, exitCode: install.exit, timedOut: install.timedOut, log: redact(`npm install failed (exit ${install.exit}):\n${install.out}`), ms: install.ms };
  }
  const build = await runCmd("npm run build", cwd, buildTimeout);
  const log = redact(`npm install ok (${install.ms}ms)\n--- npm run build (exit ${build.exit}):\n${build.out}`);
  return { pass: build.exit === 0, exitCode: build.exit, timedOut: build.timedOut, log, ms: install.ms + build.ms };
}
