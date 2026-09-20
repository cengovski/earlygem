import { NextResponse } from "next/server";
import { alertKeyboard, clusterHits, formatAlertHtml } from "@/lib/alert-msg";
import { fetchRadarBundle } from "@/lib/radar";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { DEFAULT_RULE } from "@/lib/watch";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 60;

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const cron = process.env.CRON_SECRET;
  if (cron && auth !== `Bearer ${cron}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "telegram_env_yok" });
  }
  const bundle = await fetchRadarBundle({ force: true });
  const hits = clusterHits(bundle.tape, DEFAULT_RULE.windowMin, DEFAULT_RULE.minUsd, DEFAULT_RULE.minBuys);
  let sent = 0;
  for (const hit of hits) {
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.ok && !out.skipped) sent += 1;
  }
  return NextResponse.json({ ok: true, tape: bundle.tape.length, hits: hits.length, sent });
}
