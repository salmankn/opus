// Recovery Engine (§29): classify -> retry? -> alt-strategy -> replan. Bounded (§46).
export type FailureKind = "timeout" | "network" | "invalid-input" | "tool-failure" | "verification-failure" | "resource-limit" | "unknown";

export function classify(err: unknown): FailureKind {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  if (msg.includes("abort") || msg.includes("timeout")) return "timeout";
  if (msg.includes("fetch") || msg.includes("network") || msg.includes("econn")) return "network";
  if (msg.includes("invalid input") || msg.includes("zod")) return "invalid-input";
  if (msg.includes("missing") || msg.includes("verif")) return "verification-failure";
  if (msg.includes("quota") || msg.includes("budget") || msg.includes("limit")) return "resource-limit";
  return "unknown";
}

export function shouldRetry(kind: FailureKind, attempts: number, max = Number(process.env.TASK_MAX_RETRIES ?? 3)): boolean {
  if (attempts >= max) return false;
  return kind === "timeout" || kind === "network" || kind === "tool-failure" || kind === "unknown";
}
