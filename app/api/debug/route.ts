import { recentLogs } from "@/lib/log";
import { fetchRadarBundle } from "@/lib/radar";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const started = Date.now();
  const bundle = await fetchRadarBundle({ force: true });
  return Response.json({
    ok: true,
    ms: Date.now() - started,
    meta: bundle.meta,
    pulse: bundle.status
      ? {
          wallets: bundle.status.wallets,
          fills24h: bundle.status.fills24h,
          lagSeconds: bundle.status.lagSeconds,
          source: bundle.status.source,
        }
      : null,
    traders: bundle.traders.length,
    tape: bundle.tape.length,
    gems: bundle.gems.length,
    featured: bundle.featured.length,
    dexWatch: bundle.dexWatch.length,
    sampleTraders: bundle.traders.slice(0, 5).map((t) => ({ handle: t.handle, kind: t.kind, followers: t.followers })),
    sampleDex: bundle.dexWatch.slice(0, 5).map((g) => ({ symbol: g.symbol, chain: g.chain, mcap: g.mcap, source: g.source })),
    sampleGems: bundle.featured.slice(0, 5).map((g) => ({ symbol: g.symbol, score: g.score, smart: g.smartCount, kol: g.kolCount })),
    logs: recentLogs(40),
  });
}
