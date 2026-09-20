import { NextResponse } from "next/server";
import { alertKeyboard, formatAlertHtml, type AlertHit } from "@/lib/alert-msg";
import { sessionOk } from "@/lib/admin";
import { hydrateHit } from "@/lib/dexmeta";
import { skipAlertToken } from "@/lib/alert-msg";
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
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.skipped) skipped += 1;
    else if (out.ok) sent += 1;
  }
  return NextResponse.json({ ok: true, sent, skipped, n: hits.length });
}
