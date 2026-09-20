import { recentLogs } from "@/lib/log";
import { fetchPulseStatus, fetchPulseTape, fetchPulseTraders, fetchSolanaGems } from "@/lib/sources";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  const [status, traders, tape, dex] = await Promise.all([
    fetchPulseStatus(),
    fetchPulseTraders(),
    fetchPulseTape(20),
    fetchSolanaGems(),
  ]);
  return Response.json({
    ok: true,
    ms: Date.now() - started,
    pulse: status
      ? { wallets: status.wallets, fills24h: status.fills24h, lagSeconds: status.lagSeconds, source: status.source }
      : null,
    traders: traders.length,
    tape: tape.length,
    dexWatch: dex.length,
    sampleTraders: traders.slice(0, 5).map((t) => ({ handle: t.handle, kind: t.kind, followers: t.followers })),
    sampleDex: dex.slice(0, 5).map((g) => ({ symbol: g.symbol, chain: g.chain, mcap: g.mcap })),
    logs: recentLogs(30),
  });
}
