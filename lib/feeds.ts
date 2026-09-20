import { fetchBinanceFeeds } from "./binance";
import { gmgnApiKey, gmgnSlug, chainFromGmgn } from "./gmgn";
import { classifyTrader } from "./smart";
import type { ChainId, SmartKind, TapeFill, Trader } from "./types";

const HOST = "https://openapi.gmgn.ai";
const PUMP_USERS = "https://frontend-api-v3.pump.fun/users?offset=0&limit=25&sort=followers";
const GAP = 900;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const MIN_USD = 8;

let lastAt = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gmgn(path: string, query: Record<string, string>) {
  const wait = GAP - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
  const params = new URLSearchParams({
    ...query,
    timestamp: String(Math.floor(Date.now() / 1000)),
    client_id: crypto.randomUUID(),
  });
  const res = await fetch(`${HOST}${path}?${params}`, {
    headers: { "X-APIKEY": gmgnApiKey(), Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  return (await res.json().catch(() => null)) as { data?: { list?: FeedRow[] } } | null;
}

type FeedRow = {
  transaction_hash?: string;
  maker?: string;
  side?: string;
  amount_usd?: number;
  token_amount?: number;
  price_usd?: number;
  timestamp?: number;
  base_address?: string;
  base_token?: { symbol?: string; name?: string; logo?: string; launchpad?: string };
  maker_info?: {
    tags?: string[];
    twitter_username?: string;
    twitter_name?: string;
    avatar?: string;
    name?: string;
  };
};

function tagsOf(row: FeedRow) {
  return (row.maker_info?.tags || []).map((t) => t.toLowerCase());
}

function kindFromTags(tags: string[]): SmartKind {
  if (tags.includes("kol") || tags.includes("renowned")) return "kol";
  if (tags.includes("smart_degen") || tags.includes("whale") || tags.includes("launchpad_smart")) return "smart";
  return "smart";
}

function sourcesFromTags(tags: string[]) {
  const out = new Set<string>(["gmgn"]);
  if (tags.includes("axiom")) out.add("axiom");
  if (tags.includes("gmgn") || tags.includes("gmgn_go")) out.add("gmgn");
  if (tags.includes("binance") || tags.includes("binance_wallet")) out.add("binance");
  if (tags.includes("launchpad_smart")) out.add("pumpfun");
  return [...out];
}

function toFill(row: FeedRow, chain: ChainId, feed: "kol" | "smart"): TapeFill | null {
  const side = (row.side || "").toLowerCase();
  if (side !== "buy" && side !== "sell") return null;
  const token = row.base_address;
  if (!token) return null;
  const usd = Number(row.amount_usd || 0);
  if (usd > 0 && usd < MIN_USD) return null;
  const raw = row.timestamp || 0;
  const ts = raw > 10_000_000_000 ? raw : raw * 1000;
  if (!ts || Date.now() - ts > MAX_AGE_MS) return null;
  const tags = tagsOf(row);
  const handle = row.maker_info?.twitter_username || row.maker_info?.name || row.maker?.slice(0, 8) || "wallet";
  const slug = gmgnSlug(chain) || "sol";
  const symbol = row.base_token?.symbol || "???";
  return {
    id: `feed-${row.transaction_hash || token}-${ts}`,
    ts,
    chain,
    side,
    usd,
    amount: Number(row.token_amount || 0),
    price: Number(row.price_usd || 0) || null,
    token,
    symbol,
    name: row.base_token?.name || symbol,
    mcap: null,
    liquidity: null,
    change24: null,
    pairUrl: `https://gmgn.ai/${slug}/token/${token}`,
    imageUrl: row.base_token?.logo || row.maker_info?.avatar || null,
    wallet: row.maker || null,
    handle,
    followers: null,
    profileUrl: row.maker_info?.twitter_username ? `https://x.com/${row.maker_info.twitter_username}` : null,
    rank: null,
    tx: row.transaction_hash || null,
    firstBuy: false,
    flags: [feed, ...sourcesFromTags(tags), ...(row.base_token?.launchpad ? [row.base_token.launchpad] : [])],
    source: "dexscreener",
    smartKind: kindFromTags(tags),
  };
}

function traderFromFill(fill: TapeFill, tags: string[]): Trader {
  const tagged = classifyTrader({
    handle: fill.handle || "",
    followers: fill.followers || 0,
    rank: null,
    volume: fill.usd,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    fills: 1,
  });
  const evm = fill.wallet && fill.wallet.startsWith("0x") ? fill.wallet : null;
  const sol = fill.wallet && !fill.wallet.startsWith("0x") ? fill.wallet : null;
  return {
    handle: fill.handle || fill.wallet?.slice(0, 8) || "wallet",
    address: evm,
    solana: sol,
    displayName: fill.handle || "",
    avatarUrl: fill.imageUrl,
    followers: fill.followers || 0,
    clan: null,
    profileUrl: fill.profileUrl || "",
    fills: 1,
    volume: fill.usd,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    openTokens: 0,
    rank: null,
    lastTs: fill.ts,
    kind: fill.smartKind || tagged.kind,
    smartScore: Math.max(tagged.smartScore, fill.smartKind === "kol" ? 80 : 60),
    smartReasons: sourcesFromTags(tags).map((s) => `src:${s}`),
  };
}

async function pullFeed(kind: "kol" | "smart", chain: ChainId, limit: number) {
  const slug = gmgnSlug(chain);
  if (!slug) return { fills: [] as TapeFill[], traders: [] as Trader[] };
  const path = kind === "kol" ? "/v1/user/kol" : "/v1/user/smartmoney";
  const raw = await gmgn(path, { chain: slug, limit: String(limit) });
  const rows = raw?.data?.list || [];
  const fills: TapeFill[] = [];
  const traders = new Map<string, Trader>();
  for (const row of rows) {
    const fill = toFill(row, chainFromGmgn(row as never) || chain, kind);
    if (!fill) continue;
    fills.push(fill);
    const key = (fill.wallet || fill.handle || "").toLowerCase();
    if (!key) continue;
    const prev = traders.get(key);
    const next = traderFromFill(fill, tagsOf(row));
    if (!prev) traders.set(key, next);
    else {
      prev.fills += 1;
      prev.volume += fill.usd;
      prev.lastTs = Math.max(prev.lastTs || 0, fill.ts);
      prev.solana = prev.solana || next.solana;
      prev.address = prev.address || next.address;
      prev.smartReasons = [...new Set([...prev.smartReasons, ...next.smartReasons])];
    }
  }
  return { fills, traders: [...traders.values()] };
}

async function pullPumpRoster(): Promise<Trader[]> {
  try {
    const res = await fetch(PUMP_USERS, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    const rows = (await res.json()) as Array<{
      username?: string;
      followers?: number;
      canonical_svm_wallet?: string;
      canonical_evm_wallet?: string;
      x_username?: string | null;
      profile_image?: string;
    }>;
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 25).map((row) => {
      const handle = row.x_username || row.username || row.canonical_svm_wallet?.slice(0, 8) || "pump";
      const tagged = classifyTrader({
        handle,
        followers: row.followers || 0,
        rank: null,
        volume: 0,
        realized: 0,
        unrealized: 0,
        wins: 0,
        trips: 0,
        fills: 0,
      });
      return {
        handle,
        address: row.canonical_evm_wallet || null,
        solana: row.canonical_svm_wallet || null,
        displayName: row.username || handle,
        avatarUrl: row.profile_image || null,
        followers: row.followers || 0,
        clan: null,
        profileUrl: row.x_username ? `https://x.com/${row.x_username}` : `https://pump.fun/profile/${row.username || ""}`,
        fills: 0,
        volume: 0,
        realized: 0,
        unrealized: 0,
        wins: 0,
        trips: 0,
        openTokens: 0,
        rank: null,
        lastTs: null,
        kind: tagged.kind === "noise" ? "smart" : tagged.kind,
        smartScore: Math.max(tagged.smartScore, 55),
        smartReasons: ["src:pumpfun"],
      } satisfies Trader;
    });
  } catch {
    return [];
  }
}

export function mergeTraders(base: Trader[], extra: Trader[]) {
  const map = new Map<string, Trader>();
  const put = (t: Trader) => {
    const key = (t.solana || t.address || t.handle || "").toLowerCase();
    if (!key) return;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...t });
      return;
    }
    prev.solana = prev.solana || t.solana;
    prev.address = prev.address || t.address;
    prev.followers = Math.max(prev.followers || 0, t.followers || 0);
    prev.fills += t.fills;
    prev.volume += t.volume;
    prev.lastTs = Math.max(prev.lastTs || 0, t.lastTs || 0);
    prev.smartReasons = [...new Set([...prev.smartReasons, ...t.smartReasons])];
    if (t.kind === "kol") prev.kind = "kol";
    else if (t.kind === "smart" && prev.kind !== "kol") prev.kind = "smart";
  };
  for (const t of base) put(t);
  for (const t of extra) put(t);
  return [...map.values()].sort((a, b) => b.volume - a.volume || b.followers - a.followers);
}

export async function fetchExternalFeeds(): Promise<{ fills: TapeFill[]; traders: Trader[] }> {
  const jobs = await Promise.all([
    pullFeed("kol", "solana", 40),
    pullFeed("smart", "solana", 40),
    pullFeed("kol", "bsc", 20),
    pullPumpRoster(),
    fetchBinanceFeeds(),
  ]);
  const bn = jobs[4];
  const fills = [...jobs[0].fills, ...jobs[1].fills, ...jobs[2].fills, ...bn.fills].sort((a, b) => b.ts - a.ts);
  const traders = mergeTraders([], [...jobs[0].traders, ...jobs[1].traders, ...jobs[2].traders, jobs[3], ...bn.traders]);
  return { fills, traders };
}
