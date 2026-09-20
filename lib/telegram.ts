const sent = new Map<string, number>();
const COOL_MS = 15 * 60_000;

function token() {
  return process.env.TELEGRAM_BOT_TOKEN || "";
}
function chat() {
  return process.env.TELEGRAM_CHAT_ID || "";
}

export function telegramConfigured() {
  return Boolean(token() && chat());
}

export async function sendTelegram(text: string, key?: string) {
  if (!telegramConfigured()) return { ok: false, error: "telegram_env_yok" };
  if (key) {
    const prev = sent.get(key) || 0;
    if (Date.now() - prev < COOL_MS) return { ok: true, skipped: true };
  }
  const res = await fetch(`https://api.telegram.org/bot${token()}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chat(), text, disable_web_page_preview: true }),
    signal: AbortSignal.timeout(8_000),
  });
  const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
  if (json?.ok && key) {
    sent.set(key, Date.now());
    if (sent.size > 80) {
      const cutoff = Date.now() - COOL_MS;
      for (const [k, ts] of sent) if (ts < cutoff) sent.delete(k);
    }
  }
  return { ok: Boolean(json?.ok), skipped: false };
}
