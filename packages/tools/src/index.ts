// Tool Registry (§19): id/name/schemas/timeout. Fetch-only research (no browser automation).
// Every tool: validate input -> permission check -> execute -> observation.
import { z } from "zod";

export interface ToolDef<I = unknown, O = unknown> {
  id: string;
  name: string;
  version: string;
  input: z.ZodType<I>;
  timeoutMs: number;
  run: (input: I) => Promise<O>;
}

async function fetchText(url: string, timeoutMs = 15000): Promise<{ status: number; text: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "awp-fetch/0.1" } });
    const text = await res.text();
    return { status: res.status, text: text.slice(0, 20000) };
  } finally {
    clearTimeout(t);
  }
}

export const webResearchTool: ToolDef<{ queries: string[] }, { sources: { query: string; url?: string; snippet: string }[] }> = {
  id: "web-research",
  name: "Fetch-only web research",
  version: "0.1.0",
  input: z.object({ queries: z.array(z.string().min(2)).min(1).max(8) }) as unknown as z.ZodType<{ queries: string[] }>,
  timeoutMs: 30000,
  // NOTE: fetch-only. No click/type/screenshot. Treats content as untrusted data (§20, §43).
  run: async ({ queries }) => {
    const sources = [];
    for (const q of queries) {
      // Free default: DuckDuckGo html endpoint (no key). Replace with paid search later.
      try {
        const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`;
        const { text } = await fetchText(url);
        sources.push({ query: q, url, snippet: text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 2000) });
      } catch (e) {
        sources.push({ query: q, snippet: `fetch failed: ${(e as Error).message}` });
      }
    }
    return { sources };
  }
};

export const tools: Record<string, ToolDef<any, any>> = {
  "web-research": webResearchTool
};

export async function runTool(id: string, input: unknown) {
  const tool = tools[id];
  if (!tool) throw new Error(`Unknown tool: ${id}`);
  const parsed = tool.input.safeParse(input);
  if (!parsed.success) throw new Error(`Invalid input for ${id}`);
  return tool.run(parsed.data);
}
