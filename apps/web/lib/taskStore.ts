// Ephemeral in-memory store. Replaced by Prisma once DATABASE_URL is configured.
// Keeps valid state transitions enforced per PRD §12.
export type TaskStatus =
  | "DRAFT" | "QUEUED" | "PLANNING" | "READY" | "RUNNING"
  | "WAITING" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELLED" | "PAUSED";

export interface Task {
  id: string;
  goal: string;
  projectId?: string;
  status: TaskStatus;
  createdAt: string;
}

const ALLOWED: Record<TaskStatus, TaskStatus[]> = {
  DRAFT: ["QUEUED", "CANCELLED"],
  QUEUED: ["PLANNING", "CANCELLED"],
  PLANNING: ["READY", "FAILED", "CANCELLED"],
  READY: ["RUNNING", "CANCELLED"],
  RUNNING: ["VERIFYING", "WAITING", "FAILED", "CANCELLED", "PAUSED"],
  WAITING: ["RUNNING", "CANCELLED"],
  VERIFYING: ["COMPLETED", "FAILED", "RUNNING"],
  COMPLETED: [],
  FAILED: ["QUEUED"],
  CANCELLED: ["QUEUED"],
  PAUSED: ["RUNNING", "CANCELLED"]
};

const tasks = new Map<string, Task>();

export function transition(task: Task, next: TaskStatus): Task {
  if (!ALLOWED[task.status].includes(next)) throw new Error(`Invalid transition ${task.status} -> ${next}`);
  task.status = next;
  return task;
}

export function createTask(goal: string, projectId?: string): Task {
  const task: Task = {
    id: `task_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    goal,
    projectId,
    status: "QUEUED",
    createdAt: new Date().toISOString()
  };
  tasks.set(task.id, task);
  return task;
}

export function listTasks(): Task[] {
  return [...tasks.values()].reverse();
}
