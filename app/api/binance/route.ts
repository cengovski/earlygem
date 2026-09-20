import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/auth";
import { loadBinanceFeedsDirect } from "@/lib/binance";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 20;

export async function GET(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  const data = await loadBinanceFeedsDirect().catch(() => ({ fills: [], traders: [] }));
  return NextResponse.json({ ok: true, ...data });
}
