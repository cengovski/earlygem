import { NextResponse } from "next/server";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

export async function POST(req: Request) {
  if (!telegramConfigured()) {
    return NextResponse.json({ ok: false, error: "TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID yok" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as {
    symbol?: string;
    chain?: string;
    token?: string;
    usd?: number;
    buys?: number;
    windowMin?: number;
    test?: boolean;
  } | null;
  if (body?.test) {
    const sent = await sendTelegram("earlygem test: bot bağlı.");
    return NextResponse.json(sent);
  }
  const symbol = body?.symbol || "???";
  const usd = Math.round(body?.usd || 0);
  const buys = body?.buys || 0;
  const windowMin = body?.windowMin || 3;
  const chain = body?.chain || "";
  const token = body?.token || "";
  if (!token || usd <= 0) return NextResponse.json({ ok: false, error: "bad_payload" }, { status: 400 });
  const text = [
    `earlygem ALIM`,
    `${symbol} · ${chain}`,
    `${windowMin}dk içinde ${buys} alım · $${usd.toLocaleString("en-US")}`,
    token,
  ].join("\n");
  const sent = await sendTelegram(text, `${chain}:${token.toLowerCase()}`);
  return NextResponse.json(sent);
}
