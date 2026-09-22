import { isWrappedBase } from "./alert-msg";
import { loadClientKeys } from "./client-keys";
import { markSource } from "./health";
import { logEvent, logHttpFailure } from "./log";
import { persistGet, persistSet } from "./persist";
import { isEvmWallet, isSolWallet, walletId } from "./watchlist";
import type { ChainId, TapeFill, Trader } from "./types";

const STORE = "eg_nansen_smart_v2";
const UPSTREAM = "https://api.nansen.ai/api/v1/smart-money/dex-trades";
const CACHE_MS = 24 * 60 * 60 * 1000;
const FAIL_MS = 6 * 60 * 60 * 1000;

export const NANSEN_CHAINS = ["solana", "base", "ethereum", "bnb", "robinhood"] as const;

export const NANSEN_BODY = {
  chains: [...NANSEN_CHAINS],
  filters: {
    include_smart_money_labels: ["Smart Trader", "30D Smart Trader", "90D Smart Trader", "Fund"],
    trade_value_usd: { min: 500 },
  },
  pagination: { page: 1, per_page: 500 },
  order_by: [{ field: "trade_value_usd", direction: "DESC" as const }],
};

export type NansenWallet = { chain: ChainId; address: string; handle: string };

export type NansenCache = {
  at: number;
  wallets: NansenWallet[];
  creditsRemaining: string | null;
  creditsUsed: string | null;
  error?: string;
};

type DexTrade = {
  chain?: string;
  block_timestamp?: string;
  transaction_hash?: string;
  trader_address?: string;
  trader_address_label?: string;
  token_bought_address?: string;
  token_bought_symbol?: string;
  token_bought_market_cap?: number | null;
  token_bought_amount?: number;
  trade_value_usd?: number;
};

function nansenKey() {
  return (loadClientKeys().nansen || process.env.NANSEN_API_KEY || "").trim();
}

export function chainFromNansen(raw?: string): ChainId | null {
  const s = (raw || "").toLowerCase();
  if (s === "sol" || s === "solana") return "solana";
  if (s === "base") return "base";
  if (s === "eth" || s === "ethereum") return "ethereum";
  if (s === "bnb" || s === "bsc") return "bsc";
  if (s === "rh" || s === "robinhood") return "robinhood";
  return null;
}

function isWalletOn(chain: ChainId, address: string) {
  return chain === "solana" ? isSolWallet(address) : isEvmWallet(address);
}

function migrateWallet(row: NansenWallet & { solana?: string }): NansenWallet | null {
  if (row.chain && row.address && isWalletOn(row.chain, row.address)) {
    return { chain: row.chain, address: row.address, handle: row.handle || row.address.slice(0, 8) };
  }
  if (row.solana && isSolWallet(row.solana)) {
    return { chain: "solana", address: row.solana, handle: row.handle || row.solana.slice(0, 8) };
  }
  return null;
}

export function loadNansenCache(): NansenCache | null {
  try {
    const raw = persistGet(STORE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as NansenCache;
    return { ...parsed, wallets: (parsed.wallets || []).map(migrateWallet).filter(Boolean) as NansenWallet[] };
  } catch {
    return null;
  }
}

function saveCache(row: NansenCache) {
  persistSet(STORE, JSON.stringify(row));
}

function gmgnPath(chain: ChainId) {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  return chain;
}

export function nansenChainCounts(wallets = loadNansenCache()?.wallets || []) {
  const map = new Map<ChainId, number>();
  for (const row of wallets) map.set(row.chain, (map.get(row.chain) || 0) + 1);
  return [...map.entries()].map(([chain, n]) => `${chain} ${n}`).join(" · ");
}

export function nansenCachedTraders(): Trader[] {
  return (loadNansenCache()?.wallets || []).map((row) => traderOf(row));
}

function traderOf(row: NansenWallet): Trader {
  const name = (row.handle || row.address.slice(0, 8)).replace(/^@/, "") || row.address.slice(0, 8);
  const slug = gmgnPath(row.chain);
  const sol = row.chain === "solana";
  return {
    handle: name,
    address: sol ? null : row.address,
    solana: sol ? row.address : null,
    displayName: name,
    avatarUrl: null,
    followers: 0,
    clan: null,
    profileUrl: `https://gmgn.ai/${slug}/address/${row.address}`,
    fills: 0,
    volume: 0,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    openTokens: 0,
    rank: null,
    lastTs: null,
    kind: "smart",
    smartScore: 80,
    smartReasons: ["src:nansen", `chain:${row.chain}`],
  };
}

function tsOf(raw?: string) {
  if (!raw) return 0;
  const n = Date.parse(raw);
  return Number.isFinite(n) ? n : 0;
}

function fillOf(row: DexTrade): TapeFill | null {
  const chain = chainFromNansen(row.chain);
  if (!chain) return null;
  const token = row.token_bought_address || "";
  const symbol = row.token_bought_symbol || "???";
  if (!token || isWrappedBase(token, symbol, symbol)) return null;
  const usd = Number(row.trade_value_usd || 0);
  if (usd > 0 && usd < 8) return null;
  const ts = tsOf(row.block_timestamp);
  if (!ts) return null;
  const wallet = row.trader_address || "";
  if (!isWalletOn(chain, wallet)) return null;
  const handle = (row.trader_address_label || wallet.slice(0, 8)).replace(/^@/, "");
  const slug = gmgnPath(chain);
  return {
    id: `nansen-${row.transaction_hash || token}-${ts}`,
    ts,
    chain,
    side: "buy",
    usd,
    amount: Number(row.token_bought_amount || 0),
    price: null,
    token,
    symbol,
    name: symbol,
    mcap: Number(row.token_bought_market_cap || 0) || null,
    liquidity: null,
    change24: null,
    pairUrl: `https://gmgn.ai/${slug}/token/${token}`,
    imageUrl: null,
    wallet,
    handle,
    followers: null,
    profileUrl: `https://gmgn.ai/${slug}/address/${wallet}`,
    rank: null,
    tx: row.transaction_hash || null,
    firstBuy: false,
    flags: ["nansen", "smart", chain],
    source: "dexscreener",
    smartKind: "smart",
  };
}

async function hit(key: string) {
  const url = typeof window !== "undefined" ? "/api/nansen" : UPSTREAM;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "content-type": "application/json",
  };
  if (typeof window !== "undefined") headers["x-eg-nansen"] = key;
  else headers.apikey = key;
  const started = Date.now();
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(NANSEN_BODY),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const ms = Date.now() - started;
  const json = (await res.json().catch(() => null)) as {
    data?: DexTrade[];
    error?: string;
    message?: string;
    code?: string;
    creditsRemaining?: string | null;
    creditsUsed?: string | null;
  } | null;
  const remaining = res.headers.get("x-nansen-credits-remaining") || json?.creditsRemaining || null;
  const used = res.headers.get("x-nansen-credits-used") || json?.creditsUsed || null;
  return { res, json, ms, remaining, used };
}

export async function pullNansenSmart(opts?: { force?: boolean }): Promise<{
  traders: Trader[];
  fills: TapeFill[];
  cache: NansenCache | null;
}> {
  const key = nansenKey();
  if (!key) {
    markSource("nansen", false, 0);
    return { traders: nansenCachedTraders(), fills: [], cache: loadNansenCache() };
  }
  const prev = loadNansenCache();
  const now = Date.now();
  if (!opts?.force && prev) {
    if (prev.error && now - prev.at < FAIL_MS) {
      return { traders: nansenCachedTraders(), fills: [], cache: prev };
    }
    if (!prev.error && now - prev.at < CACHE_MS) {
      markSource("nansen", prev.wallets.length > 0, prev.wallets.length);
      return { traders: nansenCachedTraders(), fills: [], cache: prev };
    }
  }
  try {
    const { res, json, ms, remaining, used } = await hit(key);
    const detail = json?.message || json?.error || json?.code || res.statusText;
    if (res.status === 429) {
      logHttpFailure({ url: UPSTREAM, event: "nansen", source: "nansen", status: 429, ms, detail: "rate_limit" });
      const cache: NansenCache = { at: now, wallets: prev?.wallets || [], creditsRemaining: remaining, creditsUsed: used, error: "rate_limit" };
      saveCache(cache);
      markSource("nansen", false, 0);
      return { traders: nansenCachedTraders(), fills: [], cache };
    }
    if (!res.ok || !json) {
      const code = json?.code || String(res.status);
      logHttpFailure({ url: UPSTREAM, event: "nansen", source: "nansen", status: res.status, ms, detail });
      const cache: NansenCache = {
        at: now,
        wallets: prev?.wallets || [],
        creditsRemaining: remaining,
        creditsUsed: used,
        error: code === "insufficient_credits" ? "insufficient_credits" : detail || "nansen_fail",
      };
      saveCache(cache);
      markSource("nansen", false, 0);
      return { traders: nansenCachedTraders(), fills: [], cache };
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    const wallets: NansenWallet[] = [];
    const seen = new Set<string>();
    const fills: TapeFill[] = [];
    for (const row of rows) {
      const fill = fillOf(row);
      if (fill) fills.push(fill);
      const chain = chainFromNansen(row.chain);
      const address = chain === "solana" ? row.trader_address || "" : (row.trader_address || "").toLowerCase();
      if (!chain || !isWalletOn(chain, address)) continue;
      const k = walletId(chain, address);
      if (seen.has(k)) continue;
      seen.add(k);
      wallets.push({
        chain,
        address,
        handle: (row.trader_address_label || address.slice(0, 8)).replace(/^@/, ""),
      });
    }
    const cache: NansenCache = {
      at: now,
      wallets,
      creditsRemaining: remaining,
      creditsUsed: used || "5",
      error: undefined,
    };
    saveCache(cache);
    markSource("nansen", wallets.length > 0, wallets.length);
    logEvent({
      level: wallets.length ? "info" : "warn",
      event: "source",
      outcome: wallets.length ? "ok" : "empty",
      source: "nansen",
      count: wallets.length,
      ms,
      url: UPSTREAM,
      detail: nansenChainCounts(wallets) || `credits ${remaining ?? "?"}`,
    });
    return { traders: nansenCachedTraders(), fills, cache };
  } catch (err) {
    logHttpFailure({ url: UPSTREAM, event: "nansen", source: "nansen", err });
    const cache: NansenCache = {
      at: now,
      wallets: prev?.wallets || [],
      creditsRemaining: prev?.creditsRemaining || null,
      creditsUsed: null,
      error: err instanceof Error ? err.message : "nansen_fail",
    };
    saveCache(cache);
    markSource("nansen", false, 0);
    return { traders: nansenCachedTraders(), fills: [], cache };
  }
}
