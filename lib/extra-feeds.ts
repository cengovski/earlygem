import { clientExtraKeys } from "./client-keys";
import { markSource } from "./health";
import { logHttpFailure } from "./log";
import { classifyTrader } from "./smart";
import type { ChainId, TapeFill, Trader } from "./types";

const CABAL = "https://api.cabalspy.xyz/v1";
const CABAL_ROTATE: Array<{ chain: string; type: string }> = [
  { chain: "solana", type: "kol" },
  { chain: "solana", type: "smart" },
  { chain: "bnb", type: "kol" },
  { chain: "base", type: "kol" },
  { chain: "eth", type: "kol" },
  { chain: "rh", type: "kol" },
];
let cabalAt = 0;
const coolUntil = new Map<string, number>();
let madeOnStore: { at: number; fills: TapeFill[]; traders: Trader[] } | null = null;

function asChain(raw: string | undefined): ChainId {
  const s = (raw || "").toLowerCase();
  if (s === "sol" || s === "solana") return "solana";
  if (s === "bsc" || s === "bnb") return "bsc";
  if (s === "base") return "base";
  if (s === "eth" || s === "ethereum") return "ethereum";
  if (s === "rh" || s === "robinhood") return "robinhood";
  return "solana";
}

function fillOf(row: {
  ts: number;
  chain: ChainId;
  token: string;
  symbol: string;
  usd: number;
  handle: string;
  wallet?: string | null;
  tx?: string | null;
  source: string;
}): TapeFill {
  return {
    id: `${row.source}-${row.tx || row.token}-${row.ts}`,
    ts: row.ts,
    chain: row.chain,
    side: "buy",
    usd: row.usd,
    amount: 0,
    price: null,
    token: row.token,
    symbol: row.symbol,
    name: row.symbol,
    mcap: null,
    liquidity: null,
    change24: null,
    pairUrl: null,
    imageUrl: null,
    wallet: row.wallet || null,
    handle: row.handle,
    followers: null,
    profileUrl: row.handle ? `https://x.com/${row.handle}` : null,
    rank: null,
    tx: row.tx || null,
    firstBuy: false,
    flags: [row.source],
    source: "dexscreener",
    smartKind: "kol",
  };
}

function traderOf(handle: string, wallet: string | null, chain: ChainId, src: string): Trader {
  const tagged = classifyTrader({
    handle,
    followers: 0,
    rank: null,
    volume: 0,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    fills: 1,
  });
  const evm = wallet?.startsWith("0x") ? wallet : null;
  const sol = wallet && !wallet.startsWith("0x") ? wallet : null;
  return {
    handle,
    address: evm,
    solana: sol,
    displayName: handle,
    avatarUrl: null,
    followers: 0,
    clan: null,
    profileUrl: handle ? `https://x.com/${handle}` : "",
    fills: 1,
    volume: 0,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    openTokens: 0,
    rank: null,
    lastTs: Date.now(),
    kind: tagged.kind === "noise" ? "smart" : tagged.kind,
    smartScore: 60,
    smartReasons: [`src:${src}`, `src:extra:${chain}`],
  };
}

function listOf(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  if (!json || typeof json !== "object") return [];
  const row = json as Record<string, unknown>;
  for (const key of ["data", "transactions", "trades", "list", "items"]) {
    const v = row[key];
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object" && Array.isArray((v as { list?: unknown[] }).list)) return (v as { list: unknown[] }).list;
  }
  return [];
}

function tsOf(row: Record<string, unknown>) {
  const raw = Number(row.timestamp || row.ts || row.time || row.block_time || 0);
  if (!raw) return 0;
  return raw > 10_000_000_000 ? raw : raw * 1000;
}

async function hit(url: string, init: RequestInit, source: string) {
  if ((coolUntil.get(source) || 0) > Date.now()) return null;
  const started = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000), ...init });
    const ms = Date.now() - started;
    if (res.status === 429) {
      coolUntil.set(source, Date.now() + 5 * 60_000);
      logHttpFailure({ url, event: source, source, status: 429, ms, detail: "rate_limit backoff 5m" });
      return null;
    }
    if (!res.ok) {
      const snippet = await res.text().catch(() => res.statusText);
      logHttpFailure({
        url,
        event: source,
        source,
        status: res.status,
        ms,
        detail: snippet.replace(/\s+/g, " ").slice(0, 160) || res.statusText,
      });
      if (res.status === 400) coolUntil.set(`${source}:${url}`, Date.now() + 60_000);
      return null;
    }
    return res;
  } catch (err) {
    logHttpFailure({ url, event: source, source, err, ms: Date.now() - started });
    return null;
  }
}

async function pullCabal(key: string) {
  const job = CABAL_ROTATE[cabalAt % CABAL_ROTATE.length];
  cabalAt += 1;
  const url = `${CABAL}/transactions/latest?blockchain=${job.chain}&type=${job.type}&limit=40`;
  const res = await hit(url, { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } }, "cabalspy");
  if (!res) {
    markSource("cabalspy", false, 0);
    return { fills: [] as TapeFill[], traders: [] as Trader[] };
  }
  const json = await res.json().catch(() => null);
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  for (const raw of listOf(json)) {
    const row = raw as Record<string, unknown>;
    const token = String(row.token_address || row.mint || row.token || row.contract || "");
    if (!token) continue;
    const side = String(row.side || row.type || row.action || "buy").toLowerCase();
    if (side !== "buy") continue;
    const usd = Number(row.amount_usd || row.usd || row.volume_usd || row.value_usd || 0);
    const ts = tsOf(row);
    if (!ts) continue;
    const wallet = String(row.wallet || row.address || row.maker || "") || null;
    const handle = String(row.twitter || row.twitter_username || row.name || row.username || wallet?.slice(0, 8) || "cabal");
    const chain = asChain(String(row.blockchain || job.chain));
    fills.push(
      fillOf({
        ts,
        chain,
        token,
        symbol: String(row.token_symbol || row.symbol || "???"),
        usd,
        handle,
        wallet,
        tx: String(row.tx || row.tx_hash || row.signature || "") || null,
        source: "cabalspy",
      }),
    );
    traders.push(traderOf(handle, wallet, chain, "cabalspy"));
  }
  markSource("cabalspy", fills.length > 0, fills.length);
  return { fills, traders };
}

async function pullMadeOnSol(key: string) {
  if (madeOnStore && Date.now() - madeOnStore.at < 10 * 60_000 && madeOnStore.fills.length) {
    return { fills: madeOnStore.fills, traders: madeOnStore.traders };
  }
  if ((coolUntil.get("madeonsol") || 0) > Date.now()) {
    return { fills: madeOnStore?.fills || [], traders: madeOnStore?.traders || [] };
  }
  const res = await hit(
    "https://madeonsol.com/api/v1/kol/feed?limit=20",
    { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } },
    "madeonsol",
  );
  if (!res) {
    markSource("madeonsol", false, 0);
    return { fills: [] as TapeFill[], traders: [] as Trader[] };
  }
  const json = await res.json().catch(() => null);
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  for (const raw of listOf(json)) {
    const row = raw as Record<string, unknown>;
    const token = String(row.token_address || row.mint || row.token || "");
    if (!token) continue;
    const usd = Number(row.usd || row.amount_usd || 0);
    const ts = tsOf(row);
    if (!ts) continue;
    const handle = String(row.kol_name || row.wallet || "kol").slice(0, 24);
    const chain = asChain(String(row.chain || "solana"));
    fills.push(
      fillOf({
        ts,
        chain,
        token,
        symbol: String(row.token_symbol || row.symbol || "???"),
        usd,
        handle,
        wallet: String(row.wallet || "") || null,
        tx: String(row.tx || row.signature || "") || null,
        source: "madeonsol",
      }),
    );
    traders.push(traderOf(handle, String(row.wallet || "") || null, chain, "madeonsol"));
  }
  markSource("madeonsol", fills.length > 0, fills.length);
  madeOnStore = { at: Date.now(), fills, traders };
  return { fills, traders };
}

async function pullSolTrack(key: string) {
  const res = await hit(
    "https://data.solanatracker.io/trades/whales?minVolume=10000&limit=30&hideArb=true",
    { headers: { "x-api-key": key, Accept: "application/json" } },
    "soltrack",
  );
  if (!res) {
    markSource("soltrack", false, 0);
    return { fills: [] as TapeFill[], traders: [] as Trader[] };
  }
  const json = await res.json().catch(() => null);
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  for (const raw of listOf(json)) {
    const row = raw as Record<string, unknown> & { token?: { address?: string; symbol?: string } };
    const token = String(row.token?.address || row.token || "");
    if (!token || token === "[object Object]") continue;
    const usd = Number(row.amountUsd || row.volume || row.amount_usd || 0);
    const ts = tsOf(row);
    if (!ts) continue;
    const handle = String(row.trader || row.wallet || "whale").slice(0, 24);
    fills.push(
      fillOf({
        ts,
        chain: "solana",
        token,
        symbol: String(row.token?.symbol || row.symbol || "???"),
        usd,
        handle,
        wallet: String(row.wallet || "") || null,
        tx: String(row.tx || row.signature || "") || null,
        source: "soltrack",
      }),
    );
    traders.push(traderOf(handle, String(row.wallet || "") || null, "solana", "soltrack"));
  }
  markSource("soltrack", fills.length > 0, fills.length);
  return { fills, traders };
}

export async function fetchExtraFeeds(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  const keys = clientExtraKeys();
  const jobs: Promise<{ fills: TapeFill[]; traders: Trader[] }>[] = [];
  if (keys.cabalspy) {
    jobs.push(
      pullCabal(keys.cabalspy).catch((err) => {
        logHttpFailure({ event: "cabalspy", source: "cabalspy", url: CABAL, err });
        return { fills: [], traders: [] };
      }),
    );
  } else markSource("cabalspy", false, 0);
  if (keys.madeonsol) {
    jobs.push(
      pullMadeOnSol(keys.madeonsol).catch((err) => {
        logHttpFailure({ event: "madeonsol", source: "madeonsol", url: "https://madeonsol.com/api/v1/kol/feed", err });
        return { fills: [], traders: [] };
      }),
    );
  }
  if (keys.soltrack) {
    jobs.push(
      pullSolTrack(keys.soltrack).catch((err) => {
        logHttpFailure({ event: "soltrack", source: "soltrack", url: "https://data.solanatracker.io/trades/whales", err });
        return { fills: [], traders: [] };
      }),
    );
  }
  if (keys.bitquery) markSource("bitquery", false, 0);
  if (!jobs.length) return { fills: [], traders: [] };
  const parts = await Promise.all(jobs);
  return {
    fills: parts.flatMap((p) => p.fills),
    traders: parts.flatMap((p) => p.traders),
  };
}
