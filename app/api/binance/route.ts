import { NextResponse } from "next/server";
import { loadBinanceFeedsDirect } from "@/lib/binance";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 20;

export async function GET() {
  const data = await loadBinanceFeedsDirect().catch(() => ({ fills: [], traders: [] }));
  return NextResponse.json({ ok: true, ...data });
}
