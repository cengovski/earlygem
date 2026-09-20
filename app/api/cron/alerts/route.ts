import { NextResponse } from "next/server";
import { fetchRadarBundle } from "@/lib/radar";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { DEFAULT_RULE, clustersFromTape } from "@/lib/watch";

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
  const hits = clustersFromTape(bundle.tape, DEFAULT_RULE);
  let sent = 0;
  for (const hit of hits) {
    const text = [
      `earlygem ALIM`,
      `${hit.symbol} · ${hit.chain}`,
      `${DEFAULT_RULE.windowMin}dk içinde ${hit.buys} alım · $${Math.round(hit.usd).toLocaleString("en-US")}`,
      hit.token,
    ].join("\n");
    const out = await sendTelegram(text, `${hit.chain}:${hit.token.toLowerCase()}`);
    if (out.ok && !out.skipped) sent += 1;
  }
  return NextResponse.json({ ok: true, tape: bundle.tape.length, hits: hits.length, sent });
}
