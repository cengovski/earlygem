import { NextResponse } from "next/server";
import { alertKeyboard, clusterHits, formatAlertHtml } from "@/lib/alert-msg";
import { requireSecret } from "@/lib/auth";
import { fetchRadarBundle } from "@/lib/radar";
import { loadSettings } from "@/lib/settings";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 60;

export async function GET(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "telegram_env_yok" });
  }
  const rule = await loadSettings();
  const bundle = await fetchRadarBundle({ force: true });
  const hits = clusterHits(bundle.tape, rule.windowMin, rule.minUsd, rule.minBuys);
  let sent = 0;
  for (const hit of hits) {
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.ok && !out.skipped) sent += 1;
  }
  return NextResponse.json({ ok: true, tape: bundle.tape.length, hits: hits.length, sent, rule });
}
