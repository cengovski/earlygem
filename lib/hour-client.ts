import { applyHourHit, formatHourDigest, hydrateHourMcaps, type HourBook, type HourHitInput } from "./hour-book";
import { sendTelegram, telegramConfigured } from "./telegram";

const KEY = "eg_hour_book";
const FLUSH_KEY = "eg_hour_flush";
const HOUR = 60 * 60_000;

export function loadHourBook(): HourBook {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "") as HourBook;
    if (raw?.from && raw.rows) return raw;
  } catch {
    /* empty */
  }
  return { from: Date.now(), rows: {} };
}

export function saveHourBook(book: HourBook) {
  localStorage.setItem(KEY, JSON.stringify(book));
}

export function noteLocalHit(row: HourHitInput) {
  const book = loadHourBook();
  if (Date.now() - book.from > HOUR * 1.2) {
    book.from = Date.now();
    book.rows = {};
  }
  applyHourHit(book, row);
  saveHourBook(book);
  return book;
}

export function clearHourBookLocal() {
  saveHourBook({ from: Date.now(), rows: {} });
}

let flushing = false;

export async function maybeFlushHourDigest() {
  if (typeof window === "undefined") return { sent: false };
  if (flushing) return { sent: false, reason: "busy" };
  flushing = true;
  try {
    const book = loadHourBook();
    if (Date.now() - book.from < HOUR) return { sent: false, reason: "window" };
    const tokens = Object.keys(book.rows).length;
    if (!tokens) {
      clearHourBookLocal();
      return { sent: false, reason: "empty" };
    }
    if (!telegramConfigured()) return { sent: false, reason: "tg" };
    const hourStamp = new Date().toISOString().slice(0, 13);
    const last = localStorage.getItem(FLUSH_KEY);
    if (last === hourStamp) return { sent: false, reason: "lock" };
    const hydrated = await hydrateHourMcaps(book);
    saveHourBook(hydrated);
    const html = formatHourDigest(hydrated);
    const out = await sendTelegram(html, `hour-${hourStamp}`, { html: true });
    if (out.ok && !out.skipped) {
      localStorage.setItem(FLUSH_KEY, hourStamp);
      clearHourBookLocal();
    }
    return { sent: Boolean(out.ok && !out.skipped), tokens };
  } finally {
    flushing = false;
  }
}
