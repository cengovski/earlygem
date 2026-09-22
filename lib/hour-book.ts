import { mcapInAlertBand, tokenLinks } from "./alert-msg";
import { fetchDexMeta } from "./dexmeta";
import type { ChainId } from "./types";
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
  mcapFirst: number | null;
  mcapLast: number | null;
  firstTs: number;
  change24: number | null;
};

export type HourBook = {
  from: number;
  rows: Record<string, HourRow>;
};

export type HourHitInput = {
  chain: string;
  token: string;
  symbol: string;
  buys?: number;
  usd?: number;
  handles?: string[];
  mcap?: number | null;
  mcapFirst?: number | null;
  change24?: number | null;
  cross?: boolean;
};

const HOUR = 60 * 60_000;
let book: HourBook = { from: Date.now(), rows: {} };

function keyOf(chain: string, token: string) {
  return `${chain}:${token.toLowerCase()}`;
}

function blankRow(row: HourHitInput): HourRow {
  return {
    chain: row.chain,
    token: row.token,
    symbol: row.symbol,
    buys: 0,
    usd: 0,
    kols: [],
    crosses: 0,
    mcap: null,
    mcapFirst: null,
    mcapLast: null,
    firstTs: Date.now(),
    change24: null,
  };
}

function coerceRow(raw: Partial<HourRow> & Pick<HourRow, "chain" | "token" | "symbol">): HourRow {
  const last = raw.mcapLast ?? raw.mcap ?? null;
  const first = raw.mcapFirst ?? last;
  return {
    chain: raw.chain,
    token: raw.token,
    symbol: raw.symbol,
    buys: Number(raw.buys || 0),
    usd: Number(raw.usd || 0),
    kols: Array.isArray(raw.kols) ? raw.kols : [],
    crosses: Number(raw.crosses || 0),
    mcap: last,
    mcapFirst: first,
    mcapLast: last,
    firstTs: raw.firstTs || Date.now(),
    change24: raw.change24 ?? null,
  };
}

export function applyHourHit(pack: HourBook, row: HourHitInput): HourBook {
  if (Date.now() - pack.from > HOUR * 2) {
    pack.from = Date.now();
    pack.rows = {};
  }
  const key = keyOf(row.chain, row.token);
  const prev = pack.rows[key] ? coerceRow(pack.rows[key]) : blankRow(row);
  prev.buys = Math.max(prev.buys, Number(row.buys || 0));
  prev.usd = Math.max(prev.usd, Number(row.usd || 0));
  prev.symbol = row.symbol || prev.symbol;
  if (row.mcapFirst && row.mcapFirst > 0 && !prev.mcapFirst) prev.mcapFirst = row.mcapFirst;
  if (row.mcap && row.mcap > 0) {
    if (!prev.mcapFirst) prev.mcapFirst = row.mcap;
    prev.mcapLast = row.mcap;
    prev.mcap = row.mcap;
  }
  if (row.change24 != null) prev.change24 = row.change24;
  for (const h of row.handles || []) {
    const name = h.replace(/^@/, "");
    if (name && !prev.kols.includes(name)) prev.kols.push(name);
  }
  if (row.cross !== false) prev.crosses += 1;
  pack.rows[key] = prev;
  return pack;
}

export function noteHourHit(row: HourHitInput) {
  applyHourHit(book, row);
  return book.rows[keyOf(row.chain, row.token)];
}

export function readHourBook(): HourBook {
  return { from: book.from, rows: { ...book.rows } };
}

export function clearHourBook() {
  book = { from: Date.now(), rows: {} };
}

export function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "\u2014";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

export async function hydrateHourMcaps(pack: HourBook): Promise<HourBook> {
  const list = Object.values(pack.rows);
  await Promise.all(
    list.map(async (row) => {
      const meta = await fetchDexMeta(row.chain as ChainId, row.token);
      if (!meta?.mcap) return;
      if (!row.mcapFirst) row.mcapFirst = meta.mcap;
      row.mcapLast = meta.mcap;
      row.mcap = meta.mcap;
      if (meta.change24 != null) row.change24 = meta.change24;
      if (meta.symbol) row.symbol = meta.symbol;
    }),
  );
  return pack;
}

export function formatHourDigest(pack: HourBook) {
  const list = Object.values(pack.rows)
    .map(coerceRow)
    .filter((row) => mcapInAlertBand(row.mcapLast || row.mcapFirst))
    .sort((a, b) => b.usd - a.usd)
    .slice(0, 12);
  if (!list.length) {
    return "<b>SAATLİK ÖZET</b>\nveri yoğunluğu sakin \u2014 eşik aşımı yok.";
  }
  const lines = [
    `<b>SAATLİK ÖZET</b>`,
    `${new Date(pack.from).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })} – şimdi`,
    "",
  ];
  for (const row of list) {
    const usd = money(row.usd);
    const tier = formatTierLine(tierFromViews(row.crosses));
    const links = tokenLinks(row.chain as ChainId, row.token);
    lines.push(`<b>$${esc(row.symbol)}</b> \u00b7 ${esc(row.chain.toUpperCase())}`);
    if (tier) lines.push(tier);
    lines.push(
      `<code>${esc(row.token)}</code>`,
      `${row.buys} alım \u00b7 ${usd} \u00b7 ${row.kols.length} cüzdan \u00b7 eşik ${row.crosses}x`,
      `MC ilk ${money(row.mcapFirst)} \u00b7 son ${money(row.mcapLast)}`,
      `<a href="${links.dex}">DexScreener</a>`,
      "",
    );
  }
  return lines.join("\n");
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
