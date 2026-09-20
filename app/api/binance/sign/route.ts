import { NextResponse } from "next/server";
import { binanceConfigured, signBinanceJobs } from "@/lib/binance";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function GET() {
  if (!binanceConfigured()) {
    return NextResponse.json({ ok: false, error: "binance_env_yok" }, { status: 400 });
  }
  const tickets = await signBinanceJobs();
  return NextResponse.json({ ok: true, tickets });
}
