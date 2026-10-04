import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ ok: true, service: "web", mode: "free-tier", browserControl: false });
}
