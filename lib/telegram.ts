import { clientTelegram } from "./client-keys";
import { logEvent, logHttpFailure } from "./log";
import { WINDOW_MS } from "./window";

const sent = new Map<string, number>();
/** Written only after a send is actually attempted. Old `eg_tg_lock` was set *before* send and skipped the first fire. */
const SENT_KEY = "eg_tg_sent";

function token() {
  if (typeof window !== "undefined") return clientTelegram().bot;
  return process.env.TELEGRAM_BOT_TOKEN || "";
}
function chat() {
  if (typeof window !== "undefined") return clientTelegram().chat;
  return process.env.TELEGRAM_CHAT_ID || "";
}

export function telegramConfigured() {
  return Boolean(token() && chat());
}

function readSent(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeSent(map: Record<string, number>) {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const next: Record<string, number> = {};
  for (const [k, ts] of Object.entries(map)) if (now - ts < WINDOW_MS) next[k] = ts;
  localStorage.setItem(SENT_KEY, JSON.stringify(next));
}

export function telegramSentAgo(key: string): number | null {
  const lock = readSent();
  if (!lock[key]) return null;
  const ago = Date.now() - lock[key];
  if (ago >= WINDOW_MS) return null;
  return ago;
}

export async function sendTelegram(
  text: string,
  key?: string,
  extra?: { html?: boolean; keyboard?: { inline_keyboard: Array<Array<{ text: string; url: string }>> } },
) {
  if (!telegramConfigured()) return { ok: false, error: "telegram_env_yok" };
  if (typeof window !== "undefined") {
    const lock = readSent();
    if (key && lock[key] && Date.now() - lock[key] < WINDOW_MS) return { ok: true, skipped: true };
    const body = new URLSearchParams();
    body.set("chat_id", chat());
    body.set("text", text);
    if (extra?.html) body.set("parse_mode", "HTML");
    body.set("disable_web_page_preview", "true");
    if (extra?.keyboard) body.set("reply_markup", JSON.stringify(extra.keyboard));
    try {
      await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
        method: "POST",
        mode: "no-cors",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
      });
      if (key) {
        lock[key] = Date.now();
        writeSent(lock);
      }
      return { ok: true, skipped: false };
    } catch (err) {
      logHttpFailure({ event: "telegram", source: "telegram", url: "https://api.telegram.org/bot***/sendMessage", err });
      return { ok: false, error: "tg_fail" };
    }
  }
  if (key) {
    const prev = sent.get(key) || 0;
    if (Date.now() - prev < WINDOW_MS) return { ok: true, skipped: true };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chat(),
        text,
        parse_mode: extra?.html ? "HTML" : undefined,
        disable_web_page_preview: true,
        reply_markup: extra?.keyboard,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
    if (!json?.ok) {
      logEvent({
        level: "error",
        event: "telegram",
        outcome: "denied",
        source: "telegram",
        status: res.status,
        url: "https://api.telegram.org/bot***/sendMessage",
        detail: "tg_api_fail",
      });
    }
    if (json?.ok && key) {
      sent.set(key, Date.now());
      if (sent.size > 80) {
        const cutoff = Date.now() - WINDOW_MS;
        for (const [k, ts] of sent) if (ts < cutoff) sent.delete(k);
      }
    }
    return { ok: Boolean(json?.ok), skipped: false };
  } catch (err) {
    logHttpFailure({ event: "telegram", source: "telegram", url: "https://api.telegram.org/bot***/sendMessage", err });
    return { ok: false, error: "tg_fail" };
  }
}
