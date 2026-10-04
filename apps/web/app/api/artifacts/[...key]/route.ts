import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { storageRoot } from "@platform/storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  html: "text/html", json: "application/json", md: "text/markdown",
  csv: "text/csv", zip: "application/zip", tsx: "text/plain",
  ts: "text/plain", js: "text/plain"
};

export async function GET(_req: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const { key } = await ctx.params;
  if (!key?.length || key.some((p) => p.includes("..") || p.includes("\\") || p === "")) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }
  const root = storageRoot();
  const full = join(root, ...key);
  if (!full.startsWith(root)) return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  try {
    const data = await readFile(full);
    const ext = key[key.length - 1]?.split(".").pop() ?? "";
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[ext] ?? "application/octet-stream",
        "Content-Disposition": ext === "zip" ? `attachment; filename="${key[key.length - 1]}"` : "inline"
      }
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
