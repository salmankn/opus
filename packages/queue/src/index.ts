// Queue (§53): Postgres-backed by default ($0, no Redis). Interface allows Upstash later.
export interface Job { id: string; type: string; payload: Record<string, unknown>; attempts: number; maxAttempts: number; runAt: string; }

const mem: Job[] = [];

export const queue = {
  async enqueue(type: string, payload: Record<string, unknown>, maxAttempts = 3): Promise<Job> {
    const job: Job = { id: `job_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,6)}`, type, payload, attempts: 0, maxAttempts, runAt: new Date().toISOString() };
    mem.push(job);
    return job;
  },
  async dequeue(): Promise<Job | null> {
    return mem.shift() ?? null;
  },
  depth(): number { return mem.length; }
};
