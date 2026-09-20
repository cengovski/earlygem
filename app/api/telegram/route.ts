import { NextResponse } from "next/server";
import { alertKeyboard, formatAlertHtml, type AlertHit } from "@/lib/alert-msg";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import type { ChainId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function POST(req: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID yok" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as (Partial<AlertHit> & { test?: boolean; windowMin?: number }) | null;
  if (body?.test) {
    const demo: AlertHit = {
      token: "So11111111111111111111111111111111111111112",
      chain: "solana",
      symbol: "SOL",
      name: "Wrapped SOL",
      usd: 4200,
      buys: 4,
      windowMin: 3,
      mcap: 80_000_000_000,
      liquidity: 1_200_000,
      change24: 2.4,
      handles: ["demo"],
    };
    const sent = await sendTelegram(formatAlertHtml(demo), undefined, {
      html: true,
      keyboard: alertKeyboard(demo.chain, demo.token),
    });
    return NextResponse.json(sent);
  }
  const token = body?.token || "";
  const chain = (body?.chain || "solana") as ChainId;
  const usd = Number(body?.usd || 0);
  if (!token || usd <= 0) return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  const hit: AlertHit = {
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
  };
  const sent = await sendTelegram(formatAlertHtml(hit), `${chain}:${token.toLowerCase()}`, {
    html: true,
    keyboard: alertKeyboard(chain, token),
  });
  return NextResponse.json(sent);
}
