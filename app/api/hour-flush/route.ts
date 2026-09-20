import { NextResponse } from "next/server";
import { formatHourDigest, type HourBook } from "@/lib/hour-book";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!telegramConfigured()) return NextResponse.json({ ok: false, error: "telegram_env_yok" }, { status: 503 });
  const body = (await req.json().catch(() => null)) as HourBook | null;
  const pack: HourBook = {
    from: Number(body?.from) || Date.now() - 60 * 60_000,
    rows: body?.rows && typeof body.rows === "object" ? body.rows : {},
  };
  const html = formatHourDigest(pack);
  const slot = new Date().toISOString().slice(0, 13);
  const out = await sendTelegram(html, `hour-${slot}`, { html: true });
  return NextResponse.json({ ok: out.ok, skipped: out.skipped, tokens: Object.keys(pack.rows).length });
}
