import { recentLogs } from "@/lib/log";
import { fetchSolWatch } from "@/lib/dexwatch";
import { PULSE_ORIGINS } from "@/lib/pulse";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const started = Date.now();
  const dexWatch = await fetchSolWatch().catch(() => []);
  return Response.json({
    ok: true,
    note: "Bu endpoint Vercel IP'den çalışır. CF worker/fomopulse burada 403 olabilir. Pulse ve GMGN tarayıcıda (anasayfa) gelir.",
    ms: Date.now() - started,
    pulseOrigins: PULSE_ORIGINS,
    dexWatch: dexWatch.length,
    sampleDex: dexWatch.slice(0, 5).map((g) => ({ symbol: g.symbol, chain: g.chain, mcap: g.mcap, source: g.source })),
    logs: recentLogs(20),
  });
}
