import { classifyTrader } from "./smart";
import type { ChainId, TapeFill, Trader } from "./types";

const HOST = "https://web3.binance.com";
const MAX_AGE_MS = 8 * 60 * 60 * 1000;

function key() {
  return process.env.BINANCE_WEB3_API_KEY || "";
}
function secret() {
  return process.env.BINANCE_WEB3_API_SECRET || "";
}

export function binanceConfigured() {
  return Boolean(key() && secret());
}

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

async function signedGet(path: string, query: Record<string, string>) {
  if (!binanceConfigured()) return null;
  const qs = new URLSearchParams(query).toString();
  const requestPath = `/build${path}${qs ? `?${qs}` : ""}`;
  const ts = new Date().toISOString();
  const pre = `${ts}GET${requestPath}`;
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(pre));
  const res = await fetch(`${HOST}${requestPath}`, {
    headers: {
      "X-OC-APIKEY": key(),
      "X-OC-TIMESTAMP": ts,
      "X-OC-SIGN": toB64(sigBuf),
      "X-OC-RECV-WINDOW": "60000",
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  return (await res.json().catch(() => null)) as Record<string, unknown> | null;
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

export async function loadBinanceFeedsDirect(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  if (!binanceConfigured()) return { fills: [], traders: [] };
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  try {
    const [smartTrades, kolTrades, smartBoard, kolBoard] = await Promise.all([
      signedGet("/api/v1/dex/market/address-tracker/trades", { trackerType: "1", tradeType: "1,2" }),
      signedGet("/api/v1/dex/market/address-tracker/trades", { trackerType: "2", tradeType: "1,2" }),
      signedGet("/api/v1/dex/market/leaderboard/list", {
        binanceChainId: "CT_501",
        timeFrame: "1",
        sortBy: "1",
        walletType: "1",
        limit: "20",
      }),
      signedGet("/api/v1/dex/market/leaderboard/list", {
        binanceChainId: "CT_501",
        timeFrame: "1",
        sortBy: "1",
        walletType: "2",
        limit: "20",
      }),
    ]);
    const smartList = (((smartTrades?.data as { trades?: BnTrade[] } | undefined)?.trades) || []) as BnTrade[];
    const kolList = (((kolTrades?.data as { trades?: BnTrade[] } | undefined)?.trades) || []) as BnTrade[];
    for (const row of smartList) {
      const fill = toFill(row, "smart");
      if (fill) fills.push(fill);
    }
    for (const row of kolList) {
      const fill = toFill(row, "kol");
      if (fill) fills.push(fill);
    }
    const smartWallets = (((smartBoard?.data as { list?: BnWallet[] } | undefined)?.list) || []) as BnWallet[];
    const kolWallets = (((kolBoard?.data as { list?: BnWallet[] } | undefined)?.list) || []) as BnWallet[];
    for (const row of smartWallets) {
      const t = traderFromWallet(row, "smart");
      if (t) traders.push(t);
    }
    for (const row of kolWallets) {
      const t = traderFromWallet(row, "kol");
      if (t) traders.push(t);
    }
  } catch {
    return { fills, traders };
  }
  return { fills: fills.sort((a, b) => b.ts - a.ts), traders };
}

export async function fetchBinanceFeeds(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/binance", { cache: "no-store", signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return { fills: [], traders: [] };
      const json = (await res.json()) as { fills?: TapeFill[]; traders?: Trader[] };
      return { fills: json.fills || [], traders: json.traders || [] };
    } catch {
      return { fills: [], traders: [] };
    }
  }
  return loadBinanceFeedsDirect();
}
