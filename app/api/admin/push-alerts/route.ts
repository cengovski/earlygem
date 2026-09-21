import { NextResponse } from "next/server";
import { attachHoneypot } from "@/lib/alert-honeypot";
import { sessionOk } from "@/lib/admin";
import { alertKeyboard, formatAlertHtml, mcapInAlertBand, skipAlertToken, type AlertHit } from "@/lib/alert-msg";
import { hydrateHit } from "@/lib/dexmeta";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!(await sessionOk(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { hits?: AlertHit[] } | null;
  const hits = (body?.hits || []).filter((h) => h?.token && h.chain && h.buys > 0 && !skipAlertToken(h)).slice(0, 8);
  let sent = 0;
  let skipped = 0;
  for (const raw of hits) {
    const hit = await hydrateHit(raw);
    if (!mcapInAlertBand(hit.mcap)) {
      skipped += 1;
      continue;
    }
    const ready = await attachHoneypot(hit);
    const out = await sendTelegram(formatAlertHtml(ready), `${ready.chain}:${ready.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(ready.chain, ready.token),
    });
    if (out.skipped) skipped += 1;
    else if (out.ok) sent += 1;
  }
  return NextResponse.json({ ok: true, sent, skipped, n: hits.length });
}
