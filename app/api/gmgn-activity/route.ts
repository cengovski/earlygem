import { NextResponse } from "next/server";
import { fetchGmgnWalletTape } from "@/lib/gmgn";
import type { Trader } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { traders?: Trader[] } | null;
  const traders = body?.traders || [];
  const rows = await fetchGmgnWalletTape(traders).catch(() => []);
  return NextResponse.json({ ok: true, count: rows.length, rows });
}
