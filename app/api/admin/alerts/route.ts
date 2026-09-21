import { NextResponse } from "next/server";
import { alertKeyboard, clusterHits, formatAlertHtml, mcapInAlertBand } from "@/lib/alert-msg";
import { sessionOk } from "@/lib/admin";
import { hydrateHit } from "@/lib/dexmeta";
import { fetchRadarBundle } from "@/lib/radar";
import { loadSettings } from "@/lib/settings";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!(await sessionOk(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as { test?: boolean } | null;
  if (body?.test) {
    const out = await sendTelegram("<b>earlygem</b> admin test", `admin-test-${Date.now()}`, { html: true });
    return NextResponse.json({ ok: out.ok, test: true, error: out.ok ? undefined : "telegram_send_fail" });
  }
  const rule = await loadSettings();
  const bundle = await fetchRadarBundle({ force: true });
  const hits = clusterHits(bundle.tape, rule.windowMin, rule.minUsd, rule.minBuys);
  let sent = 0;
  let skipped = 0;
  for (const raw of hits.slice(0, 8)) {
    const hit = await hydrateHit(raw);
    if (!mcapInAlertBand(hit.mcap)) {
      skipped += 1;
      continue;
    }
    const out = await sendTelegram(formatAlertHtml(hit), `${hit.chain}:${hit.token.toLowerCase()}`, {
      html: true,
      keyboard: alertKeyboard(hit.chain, hit.token),
    });
    if (out.skipped) skipped += 1;
    else if (out.ok) sent += 1;
  }
  return NextResponse.json({ ok: true, rule, tape: bundle.tape.length, hits: hits.length, sent, skipped });
}
