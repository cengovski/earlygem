import type { HourBook, HourRow } from "./hour-book";

const KEY = "eg_hour_book";
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

export function noteLocalHit(row: {
  chain: string;
  token: string;
  symbol: string;
  buys: number;
  usd: number;
  handles?: string[];
  mcap?: number | null;
  change24?: number | null;
}) {
  const book = loadHourBook();
  if (Date.now() - book.from > HOUR * 1.2) {
    book.from = Date.now();
    book.rows = {};
  }
  const key = `${row.chain}:${row.token.toLowerCase()}`;
  const prev: HourRow = book.rows[key] || {
    chain: row.chain,
    token: row.token,
    symbol: row.symbol,
    buys: 0,
    usd: 0,
    kols: [],
    crosses: 0,
    mcap: null,
    change24: null,
  };
  prev.buys += row.buys;
  prev.usd += row.usd;
  prev.symbol = row.symbol || prev.symbol;
  if (row.mcap) prev.mcap = row.mcap;
  if (row.change24 != null) prev.change24 = row.change24;
  for (const h of row.handles || []) {
    const name = h.replace(/^@/, "");
    if (name && !prev.kols.includes(name)) prev.kols.push(name);
  }
  prev.crosses += 1;
  book.rows[key] = prev;
  saveHourBook(book);
  return book;
}

export function clearHourBookLocal() {
  saveHourBook({ from: Date.now(), rows: {} });
}
