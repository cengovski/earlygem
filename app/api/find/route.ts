import { NextResponse } from "next/server";
import { findTrader } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ error: "q_required" }, { status: 400 });
  const row = await findTrader(q);
  return NextResponse.json(row);
}
