"use client";
import { useState } from "react";

export function TaskComposer() {
  const [goal, setGoal] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setStatus("QUEUED");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal })
    });
    const data = await res.json();
    setStatus(res.ok ? `Created: ${data.task?.id ?? "ok"} (${data.task?.status})` : `Error: ${data.error}`);
  }

  return (
    <div style={{ border: "1px solid #2a2f3d", borderRadius: 12, padding: 16 }}>
      <label htmlFor="goal">What can I do for you?</label>
      <textarea
        id="goal"
        rows={4}
        style={{ width: "100%", marginTop: 8, background: "#141824", color: "inherit", borderRadius: 8, padding: 10 }}
        placeholder="Research 20 competitors… compare pricing/features and create a spreadsheet + PDF report."
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={submit} disabled={!goal.trim()} style={{ padding: "8px 16px", borderRadius: 8 }}>
          Run Task
        </button>
        <a href="/api/tasks/demo/events" style={{ alignSelf: "center" }}>View demo events (SSE)</a>
      </div>
      {status && <p role="status">{status}</p>}
    </div>
  );
}
