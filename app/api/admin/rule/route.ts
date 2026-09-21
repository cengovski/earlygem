import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/admin";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await sessionOk(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await loadSettings());
}

export async function POST(req: Request) {
  if (!(await sessionOk(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { windowMin?: number; minUsd?: number; minBuys?: number } | null;
  if (!body) return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  const saved = await saveSettings({
    windowMin: Number(body.windowMin),
    minUsd: Number(body.minUsd),
    minBuys: Number(body.minBuys),
  });
  return NextResponse.json(saved);
}
