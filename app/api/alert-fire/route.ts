import { NextResponse } from "next/server";
import { alertKeyboard, formatAlertHtml, skipAlertToken, type AlertHit } from "@/lib/alert-msg";
import { hydrateHit } from "@/lib/dexmeta";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" }, { status: 503 });
  const rawHits = (await req.json().catch(() => null)) as { hits?: AlertHit[] } | null;
  const incoming = (rawHits?.hits || [])
    .filter((h) => h?.token && h.chain && Number(h.buys) >= 2 && Number(h.usd) >= 100)
    .slice(0, 6);
  if (!incoming.length) return NextResponse.json({ ok: true, sent: 0, skipped: 0 });
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];
  const accepted: AlertHit[] = [];
  for (const raw of incoming) {
    const hit = await hydrateHit(raw);
    if (skipAlertToken(hit)) {
      skipped += 1;
      continue;
    }
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.skipped) skipped += 1;
    else if (out.ok) {
      sent += 1;
      accepted.push(hit);
    } else errors.push(hit.symbol);
  }
  return NextResponse.json({ ok: errors.length === 0, sent, skipped, errors, accepted });
}
