import { NextResponse } from "next/server";
import { z } from "zod";
import { createTask } from "../../../lib/taskStore";

const Body = z.object({
  goal: z.string().min(3).max(8000),
  projectId: z.string().optional()
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  const task = createTask(parsed.data.goal, parsed.data.projectId);
  return NextResponse.json({ task }, { status: 201 });
}

export async function GET() {
  const { listTasks } = await import("../../../lib/taskStore");
  return NextResponse.json({ tasks: listTasks() });
}
