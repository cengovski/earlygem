import { NextResponse } from "next/server";
import { alertKeyboard, formatAlertHtml, skipAlertToken, type AlertHit } from "@/lib/alert-msg";
import { hydrateHit } from "@/lib/dexmeta";
import { noteHourHit } from "@/lib/hour-book";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { hits?: AlertHit[] } | null;
  const hits = (body?.hits || [])
    .filter((h) => h?.token && h.chain && Number(h.buys) >= 2 && Number(h.usd) >= 100)
    .filter((h) => !skipAlertToken(h))
    .slice(0, 6);
  if (!hits.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const raw of hits) {
    const hit = await hydrateHit(raw);
    noteHourHit({
      chain: hit.chain,
      token: hit.token,
      symbol: hit.symbol,
      buys: hit.buys,
      usd: hit.usd,
      handles: hit.handles,
      mcap: hit.mcap,
      change24: hit.change24,
      cross: true,
    });
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.skipped) skipped += 1;
    else if (out.ok) sent += 1;
    else errors.push(hit.symbol);
  }
  return NextResponse.json({ ok: errors.length === 0, sent, skipped, errors });
}
