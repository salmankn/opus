// Free-tier worker: polls pg-queue (in-memory shim now, Postgres later).
// Run: npm run worker -- "Research 20 AI resume builders and create a landing page"
import { queue } from "@platform/queue";
import { runTask } from "@platform/agent-runtime";

const goal = process.argv.slice(2).join(" ") || "Research top 20 AI resume builders, compare pricing, create spreadsheet + report + landing page";

const job = await queue.enqueue("agent.run", { goal });
console.log(`[worker] enqueued ${job.id} depth=${queue.depth()}`);

const next = await queue.dequeue();
if (next) {
  console.log(`[worker] running ${next.id}: ${(next.payload.goal as string).slice(0, 100)}`);
  const result = await runTask(next.payload.goal as string, (e) => console.log(`[event] ${e.type}`, JSON.stringify(e.data ?? {}).slice(0, 200)));
  console.log("[worker] done:", result);
}
