import { loadClientKeys } from "./client-keys";
import { logHttpFailure } from "./log";
import { classifyTrader } from "./smart";
import type { ChainId, TapeFill } from "./types";

const HOST = "https://api.fomoapi.io";
const GAP_MS = 2500;
const CACHE_MS = 45_000;
const TAPE_MAX_AGE_MS = 20 * 60_000;
const PAYWALL_MS = 6 * 60 * 60_000;
const PAYWALL_KEY = "eg_fomo_paywall";

let lastAt = 0;
let paywallUntil = 0;
let alertCache: { at: number; fills: TapeFill[] } | null = null;

function readPaywall() {
  if (typeof window === "undefined") return paywallUntil;
  const n = Number(window.localStorage.getItem(PAYWALL_KEY) || 0);
  return Number.isFinite(n) ? Math.max(paywallUntil, n) : paywallUntil;
}

function writePaywall(until: number) {
  paywallUntil = until;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PAYWALL_KEY, String(until));
  } catch {
    /* quota */
  }
}

export function fomoApiKey() {
  return loadClientKeys().fomo || process.env.FOMOAPI_KEY || process.env.FOMO_API_KEY || "";
}

export function fomoConfigured() {
  return Boolean(fomoApiKey());
}

async function gate() {
  const wait = GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
}

function chainOf(row: { chain?: string; chainId?: number }): ChainId | null {
  const c = (row.chain || "").toLowerCase();
  if (c === "solana" || c === "sol") return "solana";
  if (c === "base") return "base";
  if (c === "bsc" || c === "bnb") return "bsc";
  if (c === "eth" || c === "ethereum") return "ethereum";
  if (c === "monad") return "monad";
  if (c === "robinhood" || row.chainId === 4663) return null;
  return null;
}

export async function fomoGet<T>(path: string, query?: Record<string, string>): Promise<T | null> {
  const key = fomoApiKey();
  if (!key) return null;
  if (Date.now() < readPaywall()) return null;
  await gate();
  const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
  const url = `${HOST}${path}${qs}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", Authorization: `Bearer ${key}` },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - started;
    if (res.status === 429) {
      lastAt = Date.now() + 15_000;
      logHttpFailure({ url, event: "fomo", source: "fomo", status: 429, ms, detail: "rate_limit" });
      return null;
    }
    if (res.status === 402 || res.status === 401 || res.status === 403) {
      writePaywall(Date.now() + PAYWALL_MS);
      logHttpFailure({
        url,
        event: "fomo",
        source: "fomo",
        status: res.status,
        ms,
        detail: res.status === 402 ? "ödeme/kota yok · 6s dur" : "auth · 6s dur",
      });
      return null;
    }
    if (!res.ok) {
      logHttpFailure({ url, event: "fomo", source: "fomo", status: res.status, ms, detail: res.statusText });
      return null;
    }
    return (await res.json().catch(() => null)) as T | null;
  } catch (err) {
    logHttpFailure({ url, event: "fomo", source: "fomo", err, ms: Date.now() - started });
    return null;
  }
}

type FomoAlert = {
  type?: string;
  alertType?: string;
  type_?: string;
  trader?: string | { handle?: string; wallet?: string };
  token?: string | { address?: string; symbol?: string; mcap?: number };
  tokenAddress?: string;
  chain?: string;
  chainId?: number;
  usdValue?: number;
  amountToken?: number;
  txHash?: string;
  ts?: number;
  seenAt?: number;
};

function handleOf(row: FomoAlert) {
  if (typeof row.trader === "string") return row.trader;
  return row.trader?.handle || "";
}

function walletOf(row: FomoAlert) {
  if (typeof row.trader === "object") return row.trader?.wallet || null;
  return null;
}

function tokenOf(row: FomoAlert) {
  if (typeof row.token === "object") return row.token?.address || row.tokenAddress || "";
  return row.tokenAddress || "";
}

function symbolOf(row: FomoAlert) {
  if (typeof row.token === "object") return row.token?.symbol || "???";
  return typeof row.token === "string" ? row.token : "???";
}

export async function fetchFomoAlerts(): Promise<TapeFill[]> {
  if (!fomoConfigured()) return [];
  if (alertCache && Date.now() - alertCache.at < CACHE_MS) return alertCache.fills;
  const raw = await fomoGet<{ data?: FomoAlert[]; alerts?: FomoAlert[] } | FomoAlert[]>("/v2/alerts", {
    limit: "40",
  });
  const rows = Array.isArray(raw) ? raw : raw?.data || raw?.alerts || [];
  const fills: TapeFill[] = [];
  for (const row of rows) {
    const sideRaw = (row.alertType || row.type_ || row.type || "").toLowerCase();
    if (sideRaw !== "buy") continue;
    const token = tokenOf(row);
    const chain = chainOf(row);
    if (!token || !chain) continue;
    const ts = Number(row.ts || row.seenAt || 0);
    const at = ts > 10_000_000_000 ? ts : ts * 1000;
    if (!at || Date.now() - at > TAPE_MAX_AGE_MS) continue;
    const handle = handleOf(row);
    const tagged = classifyTrader({
      handle,
      followers: 0,
      rank: null,
      volume: Number(row.usdValue || 0),
      realized: 0,
      unrealized: 0,
      wins: 0,
      trips: 0,
      fills: 1,
    });
    fills.push({
      id: `fomoapi-${row.txHash || token}-${at}`,
      ts: at,
      chain,
      side: "buy",
      usd: Number(row.usdValue || 0),
      amount: Number(row.amountToken || 0),
      price: null,
      token,
      symbol: symbolOf(row),
      name: symbolOf(row),
      mcap: typeof row.token === "object" ? row.token?.mcap || null : null,
      liquidity: null,
      change24: null,
      pairUrl: null,
      imageUrl: null,
      wallet: walletOf(row),
      handle: handle || null,
      followers: null,
      profileUrl: handle ? `https://fomo.family/profile/${handle}` : null,
      rank: null,
      tx: row.txHash || null,
      firstBuy: false,
      flags: ["fomoapi", tagged.kind],
      source: "fomopulse",
      smartKind: tagged.kind,
    });
  }
  alertCache = { at: Date.now(), fills };
  return fills;
}

export async function fetchFomoUser(handle: string): Promise<{ evm?: string | null; solana?: string | null } | null> {
  if (!fomoConfigured() || !handle) return null;
  const raw = await fomoGet<{ wallets?: { evm?: string; solana?: string } }>(`/v2/users/${encodeURIComponent(handle)}`);
  return raw?.wallets || null;
}
