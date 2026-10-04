// Demo SSE stream of PRD §34 events for a fake task lifecycle.
const EVENTS = [
  "TASK_STARTED",
  "PLAN_CREATED",
  "STEP_STARTED",
  "TOOL_STARTED",
  "TOOL_COMPLETED",
  "OBSERVATION_CREATED",
  "STEP_COMPLETED",
  "VERIFICATION_STARTED",
  "VERIFICATION_PASSED",
  "TASK_COMPLETED"
];

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      let i = 0;
      const timer = setInterval(() => {
        if (i >= EVENTS.length) {
          clearInterval(timer);
          controller.close();
          return;
        }
        controller.enqueue(enc.encode(`event: ${EVENTS[i]}\ndata: {"seq":${i},"type":"${EVENTS[i]}"}\n\n`));
        i++;
      }, 400);
    }
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" }
  });
}
