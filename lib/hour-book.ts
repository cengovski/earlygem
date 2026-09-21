import { formatTierLine, tierFromViews } from "./tier";

export type HourRow = {
  chain: string;
  token: string;
  symbol: string;
  buys: number;
  usd: number;
  kols: string[];
  crosses: number;
  mcap: number | null;
  change24: number | null;
};

export type HourBook = {
  from: number;
  rows: Record<string, HourRow>;
};

const HOUR = 60 * 60_000;
let book: HourBook = { from: Date.now(), rows: {} };

function keyOf(chain: string, token: string) {
  return `${chain}:${token.toLowerCase()}`;
}

export function noteHourHit(row: {
  chain: string;
  token: string;
  symbol: string;
  buys?: number;
  usd?: number;
  handles?: string[];
  mcap?: number | null;
  change24?: number | null;
  cross?: boolean;
}) {
  if (Date.now() - book.from > HOUR * 2) book = { from: Date.now(), rows: {} };
  const key = keyOf(row.chain, row.token);
  const prev = book.rows[key] || {
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
  prev.buys += Number(row.buys || 0);
  prev.usd += Number(row.usd || 0);
  prev.symbol = row.symbol || prev.symbol;
  if (row.mcap) prev.mcap = row.mcap;
  if (row.change24 != null) prev.change24 = row.change24;
  for (const h of row.handles || []) {
    const name = h.replace(/^@/, "");
    if (name && !prev.kols.includes(name)) prev.kols.push(name);
  }
  if (row.cross !== false) prev.crosses += 1;
  book.rows[key] = prev;
  return prev;
}

export function readHourBook(): HourBook {
  return { from: book.from, rows: { ...book.rows } };
}

export function clearHourBook() {
  book = { from: Date.now(), rows: {} };
}

export function formatHourDigest(pack: HourBook) {
  const list = Object.values(pack.rows).sort((a, b) => b.usd - a.usd).slice(0, 12);
  if (!list.length) {
    return "<b>SAATLİK ÖZET</b>\nveri yoğunluğu sakin \u2014 eşik aşımı yok.";
  }
  const lines = [`<b>SAATLİK ÖZET</b>`, `${new Date(pack.from).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} – şimdi`, ""];
  for (const row of list) {
    const mc = row.mcap && row.mcap >= 1_000_000 ? `$${(row.mcap / 1_000_000).toFixed(2)}M` : row.mcap ? `$${Math.round(row.mcap)}` : "\u2014";
    const ch = row.change24 != null ? `${row.change24 >= 0 ? "+" : ""}${row.change24.toFixed(1)}%` : "\u2014";
    const usd = row.usd >= 1000 ? `$${(row.usd / 1000).toFixed(1)}k` : `$${Math.round(row.usd)}`;
    const tier = formatTierLine(tierFromViews(row.crosses));
    lines.push(`<b>$${esc(row.symbol)}</b> \u00b7 ${esc(row.chain.toUpperCase())}`);
    if (tier) lines.push(tier);
    lines.push(
      `<code>${esc(row.token)}</code>`,
      `${row.buys} alım \u00b7 ${usd} \u00b7 ${row.kols.length} KOL \u00b7 eşik ${row.crosses}x`,
      `MC ${mc} \u00b7 1s ${esc(ch)}`,
      "",
    );
  }
  return lines.join("\n");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
