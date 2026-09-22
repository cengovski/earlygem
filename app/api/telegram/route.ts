import { NextResponse } from "next/server";
import { attachHoneypot } from "@/lib/alert-honeypot";
import { alertKeyboard, formatAlertHtml, isWrappedBase, mcapInAlertBand, type AlertHit } from "@/lib/alert-msg";
import { requireSecret } from "@/lib/auth";
import { hydrateHit } from "@/lib/dexmeta";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import type { ChainId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

const CHAINS: ChainId[] = ["robinhood", "solana", "base", "bsc", "ethereum", "monad"];
const TOKEN_RE = /^[A-Za-z0-9]{32,64}$/;

export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID yok" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as (Partial<AlertHit> & { test?: boolean; windowMin?: number }) | null;
  if (body?.test) {
    const sent = await sendTelegram("earlygem test: bot bağlı.");
    return NextResponse.json(sent);
  }
  const chain = body?.chain as ChainId | undefined;
  const token = body?.token || "";
  const usd = Number(body?.usd || 0);
  if (!chain || !CHAINS.includes(chain) || !TOKEN_RE.test(token) || usd <= 0) {
    return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  }
  if (isWrappedBase(token, body?.symbol, body?.name)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "wrapped" });
  }
  const hit = await hydrateHit({
    token,
    chain,
    symbol: body?.symbol || "???",
    name: body?.name,
    usd,
    buys: body?.buys || 0,
    windowMin: body?.windowMin || 3,
    mcap: body?.mcap ?? null,
    liquidity: body?.liquidity ?? null,
    change24: body?.change24 ?? null,
    handles: body?.handles || [],
    buyers: body?.buyers,
  });
  if (!mcapInAlertBand(hit.mcap)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "mcap_band" });
  }
  const ready = await attachHoneypot(hit);
  const sent = await sendTelegram(formatAlertHtml(ready), `${chain}:${token.toLowerCase()}`, {
    html: true,
    keyboard: alertKeyboard(chain, token),
  });
  return NextResponse.json(sent);
}
