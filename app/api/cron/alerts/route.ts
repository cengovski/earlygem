import { NextResponse } from "next/server";
import { requireSecret } from "@/lib/auth";
import { clearHourBook, formatHourDigest, hydrateHourMcaps, noteHourHit, readHourBook } from "@/lib/hour-book";
import { fetchRadarBundle } from "@/lib/radar";
import { loadSettings } from "@/lib/settings";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { clusterHits } from "@/lib/alert-msg";
import { hydrateHit } from "@/lib/dexmeta";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" });

  const rule = await loadSettings();
  let pack = readHourBook();
  if (!Object.keys(pack.rows).length) {
    const bundle = await fetchRadarBundle({ force: true });
    const since = Date.now() - 60 * 60_000;
    const hourTape = bundle.tape.filter((r) => r.ts >= since && r.side === "buy");
    const hits = clusterHits(hourTape, 60, rule.minUsd, rule.minBuys);
    for (const hit of hits) {
      const hydrated = await hydrateHit(hit);
      noteHourHit({
        chain: hydrated.chain,
        token: hydrated.token,
        symbol: hydrated.symbol,
        buys: hydrated.buys,
        usd: hydrated.usd,
        handles: hydrated.handles,
        mcapFirst: hit.mcap || hydrated.mcap,
        mcap: hydrated.mcap,
        change24: hydrated.change24,
        cross: true,
      });
    }
    pack = readHourBook();
  }

  if (!Object.keys(pack.rows).length) {
    return NextResponse.json({ ok: true, skipped: true, tokens: 0, note: "empty_no_telegram" });
  }

  const html = formatHourDigest(await hydrateHourMcaps(pack));
  const out = await sendTelegram(html, `hour-${new Date().toISOString().slice(0, 13)}`, { html: true });
  if (out.ok && !out.skipped) clearHourBook();
  return NextResponse.json({ ok: out.ok, skipped: out.skipped, tokens: Object.keys(pack.rows).length });
}
