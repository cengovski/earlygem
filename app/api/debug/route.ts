import { NextResponse } from "next/server";
import { fetchSolWatch } from "@/lib/dexwatch";
import { recentLogs } from "@/lib/log";
import { PULSE_ORIGINS } from "@/lib/pulse";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const started = Date.now();
  const dexWatch = await fetchSolWatch().catch(() => []);
  return NextResponse.json({
    ok: true,
    ms: Date.now() - started,
    pulseOrigins: PULSE_ORIGINS,
    dexWatch: dexWatch.length,
    sampleDex: dexWatch.slice(0, 5).map((g) => ({ symbol: g.symbol, chain: g.chain, mcap: g.mcap, source: g.source })),
    logs: recentLogs(20),
  });
}
