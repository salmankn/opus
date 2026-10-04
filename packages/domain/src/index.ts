// Domain: task state machine (§12) + tenancy guard (§10, §42).
export type TaskStatus = "DRAFT"|"QUEUED"|"PLANNING"|"READY"|"RUNNING"|"WAITING"|"VERIFYING"|"COMPLETED"|"FAILED"|"CANCELLED"|"PAUSED";

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["QUEUED","CANCELLED"],
  QUEUED: ["PLANNING","CANCELLED"],
  PLANNING: ["READY","FAILED","CANCELLED"],
  READY: ["RUNNING","CANCELLED"],
  RUNNING: ["VERIFYING","WAITING","FAILED","CANCELLED","PAUSED"],
  WAITING: ["RUNNING","CANCELLED"],
  VERIFYING: ["COMPLETED","FAILED","RUNNING"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: ["QUEUED"],
  PAUSED: ["RUNNING","CANCELLED"]
};

export function canTransition(from: TaskStatus, to: TaskStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: TaskStatus, to: TaskStatus): void {
  if (!canTransition(from, to)) throw new Error(`Invalid task transition ${from} -> ${to}`);
}

// Never trust client-provided workspace IDs — always resolve via membership.
export function assertWorkspaceMember(memberWorkspaceId: string, resourceWorkspaceId: string): void {
  if (memberWorkspaceId !== resourceWorkspaceId) throw new Error("Cross-tenant access denied");
}

// File safety (§25): reject absolute paths and traversal.
export function assertSafeRelativePath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\") || path.startsWith("~")) {
    throw new Error(`Unsafe file path: ${path}`);
  }
}
