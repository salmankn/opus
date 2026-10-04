// Storage (§33-34, §54): local dir by default ($0); S3-compatible (R2/Supabase) via env.
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

// Resolve the workspace root so web (apps/web cwd) and worker (root cwd) share one store.
function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    try {
      const pkg = JSON.parse(String(readFileSync(join(dir, "package.json"))));
      if (pkg.workspaces) return dir;
    } catch { /* keep walking up */ }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export function storageRoot(): string {
  const configured = process.env.STORAGE_LOCAL_DIR ?? "./storage-local";
  if (/^(?:[a-zA-Z]:\\|\\\\|\/)/.test(configured)) return configured;
  return join(workspaceRoot(), configured);
}

function localDir(): string {
  return storageRoot();
}

export async function putArtifact(key: string, data: Uint8Array | string): Promise<{ key: string; size: number }> {
  if ((process.env.STORAGE_PROVIDER ?? "local") !== "local") {
    throw new Error("S3 provider not wired in MVP skeleton — set STORAGE_PROVIDER=local or implement R2 client");
  }
  const base = localDir();
  const full = join(base, key);
  if (key.includes("..") || key.startsWith("/") || key.includes("\\")) throw new Error("Unsafe storage key");
  await mkdir(dirname(full), { recursive: true });
  const buf = typeof data === "string" ? Buffer.from(data, "utf8") : Buffer.from(data);
  await writeFile(full, buf);
  return { key, size: buf.length };
}

export async function getArtifact(key: string): Promise<Buffer> {
  const full = join(localDir(), key);
  return readFile(full);
}

export async function artifactExists(key: string): Promise<boolean> {
  try { await stat(join(localDir(), key)); return true; } catch { return false; }
}
