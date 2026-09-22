import { clientBinance } from "./client-keys";
import { logHttpFailure } from "./log";
import { classifyTrader } from "./smart";
import type { ChainId, TapeFill, Trader } from "./types";

const HOST = "https://web3.binance.com";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function key() {
  return clientBinance().key || process.env.BINANCE_WEB3_API_KEY || "";
}
function secret() {
  return clientBinance().secret || process.env.BINANCE_WEB3_API_SECRET || "";
}

export function binanceConfigured() {
  return Boolean(key() && secret());
}

export type BinanceTicket = {
  id: string;
  url: string;
  headers: Record<string, string>;
};

const JOBS: Array<{ id: string; path: string; query: Record<string, string> }> = [
  { id: "smart_trades", path: "/api/v1/dex/market/address-tracker/trades", query: { trackerType: "1" } },
  { id: "kol_trades", path: "/api/v1/dex/market/address-tracker/trades", query: { trackerType: "2" } },
  {
    id: "smart_board",
    path: "/api/v1/dex/market/leaderboard/list",
    query: { binanceChainId: "56", timeFrame: "1", sortBy: "1", limit: "50" },
  },
  {
    id: "kol_board",
    path: "/api/v1/dex/market/leaderboard/list",
    query: { binanceChainId: "CT_501", timeFrame: "1", sortBy: "1", limit: "50" },
  },
];

function chainFromBn(id: string | undefined): ChainId | null {
  const v = String(id || "");
  if (v === "CT_501" || v === "501") return "solana";
  if (v === "56") return "bsc";
  if (v === "8453" || v === "CT_8453") return "base";
  if (v === "1") return "ethereum";
  if (v === "10143" || v === "CT_10143") return "monad";
  if (v === "4663" || v === "CT_4663") return "robinhood";
  return null;
}

function toB64(buf: ArrayBuffer) {
  let out = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) out += String.fromCharCode(bytes[i]);
  return btoa(out);
}

async function signOne(path: string, query: Record<string, string>): Promise<{ url: string; headers: Record<string, string> }> {
  const qs = new URLSearchParams(query).toString();
  const requestPath = `/build${path}${qs ? `?${qs}` : ""}`;
  const ts = new Date().toISOString();
  const pre = `${ts}GET${requestPath}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(pre));
  return {
    url: `${HOST}${requestPath}`,
    headers: {
      "X-OC-APIKEY": key(),
      "X-OC-TIMESTAMP": ts,
      "X-OC-SIGN": toB64(sigBuf),
      "X-OC-RECV-WINDOW": "60000",
      Accept: "application/json",
    },
  };
}

export async function signBinanceJobs(): Promise<BinanceTicket[]> {
  if (!binanceConfigured()) return [];
  const out: BinanceTicket[] = [];
  for (const job of JOBS) {
    const signed = await signOne(job.path, job.query);
    out.push({ id: job.id, ...signed });
  }
  return out;
}

let binanceCoolUntil = 0;

async function signedGet(path: string, query: Record<string, string>) {
  if (!binanceConfigured() || Date.now() < binanceCoolUntil) return null;
  const signed = await signOne(path, query);
  const started = Date.now();
  try {
    const res = await fetch(signed.url, {
      headers: signed.headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      logHttpFailure({ url: signed.url, event: "binance", source: "binance", status: res.status, ms, detail: res.statusText });
      return null;
    }
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    if (/failed to fetch|networkerror|load failed/i.test(msg)) binanceCoolUntil = Date.now() + 5 * 60_000;
    logHttpFailure({ url: signed.url, event: "binance", source: "binance", err, ms: Date.now() - started });
    return null;
  }
}

type BnTrade = {
  txHash?: string;
  walletAddress?: string;
  tokenSymbol?: string;
  tokenContractAddress?: string;
  binanceChainId?: string;
  tokenPrice?: string;
  marketCap?: string;
  tradeType?: string | number;
  tradeTime?: string | number;
  amountUsd?: string | number;
  usdAmount?: string | number;
};

type BnWallet = {
  walletAddress?: string;
  address?: string;
  twitter?: string;
  twitterName?: string;
  realizedPnlUsd?: string | number;
  winRatePercent?: string | number;
  txs?: string | number;
  volumeUsd?: string | number;
};

function toFill(row: BnTrade, kind: "smart" | "kol"): TapeFill | null {
  const type = String(row.tradeType || "");
  if (type !== "1" && type !== "2") return null;
  const token = row.tokenContractAddress;
  if (!token) return null;
  const chain = chainFromBn(row.binanceChainId);
  if (!chain) return null;
  const raw = Number(row.tradeTime || 0);
  const ts = raw > 10_000_000_000 ? raw : raw * 1000;
  if (!ts || Date.now() - ts > MAX_AGE_MS) return null;
  const usd = Number(row.amountUsd || row.usdAmount || 0);
  const handle = (row.walletAddress || "wallet").slice(0, 8);
  return {
    id: `bn-${row.txHash || token}-${ts}`,
    ts,
    chain,
    side: type === "1" ? "buy" : "sell",
    usd,
    amount: 0,
    price: Number(row.tokenPrice || 0) || null,
    token,
    symbol: row.tokenSymbol || "???",
    name: row.tokenSymbol || "???",
    mcap: Number(row.marketCap || 0) || null,
    liquidity: null,
    change24: null,
    pairUrl: null,
    imageUrl: null,
    wallet: row.walletAddress || null,
    handle,
    followers: null,
    profileUrl: null,
    rank: null,
    tx: row.txHash || null,
    firstBuy: false,
    flags: ["binance", kind],
    source: "dexscreener",
    smartKind: kind === "kol" ? "kol" : "smart",
  };
}

function traderFromWallet(row: BnWallet, kind: "smart" | "kol"): Trader | null {
  const addr = row.walletAddress || row.address;
  if (!addr) return null;
  const handle = row.twitter || row.twitterName || addr.slice(0, 8);
  const evm = addr.startsWith("0x") ? addr : null;
  const sol = addr.startsWith("0x") ? null : addr;
  const tagged = classifyTrader({
    handle,
    followers: 0,
    rank: null,
    volume: Number(row.volumeUsd || 0),
    realized: Number(row.realizedPnlUsd || 0),
    unrealized: 0,
    wins: 0,
    trips: Number(row.txs || 0),
    fills: Number(row.txs || 0),
  });
  return {
    handle,
    address: evm,
    solana: sol,
    displayName: handle,
    avatarUrl: null,
    followers: 0,
    clan: null,
    profileUrl: row.twitter ? `https://x.com/${row.twitter}` : "",
    fills: Number(row.txs || 0),
    volume: Number(row.volumeUsd || 0),
    realized: Number(row.realizedPnlUsd || 0),
    unrealized: 0,
    wins: 0,
    trips: Number(row.txs || 0),
    openTokens: 0,
    rank: null,
    lastTs: Date.now(),
    kind: kind === "kol" ? "kol" : tagged.kind === "noise" ? "smart" : tagged.kind,
    smartScore: Math.max(tagged.smartScore, kind === "kol" ? 75 : 60),
    smartReasons: ["src:binance"],
  };
}

function boardRows(payload: Record<string, unknown> | null | undefined): BnWallet[] {
  const data = (payload?.data || {}) as { items?: BnWallet[]; list?: BnWallet[] };
  return data.items || data.list || [];
}

export function parseBinancePayloads(rows: Record<string, Record<string, unknown> | null>) {
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  const smartList = (((rows.smart_trades?.data as { trades?: BnTrade[] } | undefined)?.trades) || []) as BnTrade[];
  const kolList = (((rows.kol_trades?.data as { trades?: BnTrade[] } | undefined)?.trades) || []) as BnTrade[];
  for (const row of smartList) {
    const fill = toFill(row, "smart");
    if (fill) fills.push(fill);
  }
  for (const row of kolList) {
    const fill = toFill(row, "kol");
    if (fill) fills.push(fill);
  }
  for (const row of boardRows(rows.smart_board)) {
    const t = traderFromWallet(row, "smart");
    if (t) traders.push(t);
  }
  for (const row of boardRows(rows.kol_board)) {
    const t = traderFromWallet(row, "kol");
    if (t) traders.push(t);
  }
  return {
    fills: fills.sort((a, b) => b.ts - a.ts),
    traders,
    code: Number(rows.smart_trades?.code ?? rows.kol_trades?.code ?? rows.smart_board?.code ?? 0),
  };
}

export async function fetchBinanceFeeds(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  if (!binanceConfigured()) return { fills: [], traders: [] };
  try {
    const bag: Record<string, Record<string, unknown> | null> = {};
    for (const job of JOBS) {
      bag[job.id] = await signedGet(job.path, job.query);
    }
    return parseBinancePayloads(bag);
  } catch (err) {
    logHttpFailure({ event: "binance", source: "binance", url: HOST, err });
    return { fills: [], traders: [] };
  }
}
