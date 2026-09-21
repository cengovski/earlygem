import { clientExtraKeys } from "./client-keys";
import { classifyTrader } from "./smart";
import type { ChainId, TapeFill, Trader } from "./types";

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

function traderOf(handle: string, wallet: string | null, chain: ChainId): Trader {
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
    smartReasons: [`src:extra:${chain}`],
  };
}

async function pullMadeOnSol(key: string) {
  const res = await fetch("https://madeonsol.com/api/v1/kol/feed?limit=20", {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return { fills: [] as TapeFill[], traders: [] as Trader[] };
  const json = (await res.json().catch(() => null)) as {
    trades?: Array<{
      timestamp?: number;
      chain?: string;
      token_address?: string;
      token_symbol?: string;
      usd?: number;
      amount_usd?: number;
      kol_name?: string;
      wallet?: string;
      tx?: string;
      signature?: string;
    }>;
  } | null;
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  for (const row of json?.trades || []) {
    const token = row.token_address;
    if (!token) continue;
    const usd = Number(row.usd || row.amount_usd || 0);
    if (usd && usd < 8) continue;
    const ts = (row.timestamp || 0) > 10_000_000_000 ? Number(row.timestamp) : Number(row.timestamp || 0) * 1000;
    if (!ts) continue;
    const handle = row.kol_name || row.wallet?.slice(0, 8) || "kol";
    const chain = asChain(row.chain);
    fills.push(
      fillOf({
        ts,
        chain,
        token,
        symbol: row.token_symbol || "???",
        usd,
        handle,
        wallet: row.wallet,
        tx: row.tx || row.signature,
        source: "madeonsol",
      }),
    );
    traders.push(traderOf(handle, row.wallet || null, chain));
  }
  return { fills, traders };
}

async function pullSolTrack(key: string) {
  const res = await fetch("https://data.solanatracker.io/trades/whales?minVolume=10000&limit=30&hideArb=true", {
    headers: { "x-api-key": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return { fills: [] as TapeFill[], traders: [] as Trader[] };
  const json = (await res.json().catch(() => null)) as unknown;
  const rows = Array.isArray(json) ? json : ((json as { trades?: unknown[] } | null)?.trades || []);
  const fills: TapeFill[] = [];
  const traders: Trader[] = [];
  for (const raw of rows) {
    const row = raw as {
      timestamp?: number;
      token?: { address?: string; symbol?: string };
      amountUsd?: number;
      volume?: number;
      wallet?: string;
      trader?: string;
      tx?: string;
      signature?: string;
    };
    const token = row.token?.address;
    if (!token) continue;
    const usd = Number(row.amountUsd || row.volume || 0);
    const ts = (row.timestamp || 0) > 10_000_000_000 ? Number(row.timestamp) : Number(row.timestamp || 0) * 1000;
    if (!ts) continue;
    const handle = row.trader || row.wallet?.slice(0, 8) || "whale";
    fills.push(
      fillOf({
        ts,
        chain: "solana",
        token,
        symbol: row.token?.symbol || "???",
        usd,
        handle,
        wallet: row.wallet,
        tx: row.tx || row.signature,
        source: "soltrack",
      }),
    );
    traders.push(traderOf(handle, row.wallet || null, "solana"));
  }
  return { fills, traders };
}

export async function fetchExtraFeeds(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  const keys = clientExtraKeys();
  const jobs: Promise<{ fills: TapeFill[]; traders: Trader[] }>[] = [];
  if (keys.madeonsol) jobs.push(pullMadeOnSol(keys.madeonsol).catch(() => ({ fills: [], traders: [] })));
  if (keys.soltrack) jobs.push(pullSolTrack(keys.soltrack).catch(() => ({ fills: [], traders: [] })));
  if (!jobs.length) return { fills: [], traders: [] };
  const parts = await Promise.all(jobs);
  return {
    fills: parts.flatMap((p) => p.fills),
    traders: parts.flatMap((p) => p.traders),
  };
}
