import { traderSourceFlags } from "./alert-msg";
import { clientGmgnKey } from "./client-keys";
import { logHttpFailure } from "./log";
import type { ChainId, SmartKind, TapeFill, Trader } from "./types";

const HOST = "https://openapi.gmgn.ai";
const MIN_GAP_MS = 900;
const MAX_JOBS = 3;
const MIN_USD = 8;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const STOCK = /^(googlb?|gmeb?|qqqb?|nvdab?|tslab?|aaplb?|msftb?|metab?|amznb?|gstock|sndk|qqq|spy|iwm)$/i;

export const GMGN_FOMO_EVM: ChainId[] = ["robinhood", "base", "bsc", "ethereum", "monad"];

export function gmgnApiKey() {
  return clientGmgnKey() || process.env.GMGN_API_KEY || "";
}

export function gmgnConfigured() {
  return Boolean(gmgnApiKey());
}

export function gmgnSlug(chain: ChainId): string | null {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "base" || chain === "bsc" || chain === "robinhood" || chain === "monad") return chain;
  return null;
}

export function chainFromGmgn(slug: string | undefined): ChainId | null {
  if (slug === "sol") return "solana";
  if (slug === "eth") return "ethereum";
  if (slug === "base" || slug === "bsc" || slug === "robinhood" || slug === "monad") return slug;
  return null;
}

type GmgnToken = { address?: string; symbol?: string; logo?: string; name?: string };
type GmgnActivity = {
  wallet?: string;
  chain?: string;
  tx_hash?: string;
  timestamp?: number;
  event_type?: string;
  token_amount?: string;
  cost_usd?: string | number | null;
  price_usd?: string | number | null;
  token?: GmgnToken;
};
type GmgnEnvelope = {
  code?: number;
  error?: string;
  data?: { activities?: GmgnActivity[]; list?: GmgnActivity[] };
};

let lastAt = 0;
let coolUntil = 0;
let evmCursor = 0;

async function gate() {
  const wait = MIN_GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt = Date.now();
}

/** Browser hits /api/gmgn so Cloudflare/Opera cannot kill openapi.gmgn.ai with Failed to fetch. */
export async function gmgnRequest(path: string, query: Record<string, string | number | undefined>): Promise<Record<string, unknown> | null> {
  const key = gmgnApiKey();
  if (!key) return null;
  if (Date.now() < coolUntil) return null;
  const params = new URLSearchParams();
  for (const [k, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(k, String(value));
  }
  params.set("timestamp", String(Math.floor(Date.now() / 1000)));
  params.set("client_id", crypto.randomUUID());
  await gate();
  const upstream = `${HOST}${path}?${params.toString()}`;
  const url =
    typeof window !== "undefined" ? `/api/gmgn?path=${encodeURIComponent(path)}&${params.toString()}` : upstream;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers:
        typeof window !== "undefined"
          ? { "x-eg-gmgn": key, Accept: "application/json" }
          : { "X-APIKEY": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - started;
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const errText = typeof json?.error === "string" ? json.error : "";
    if (res.status === 429 || errText === "RATE_LIMIT_EXCEEDED" || errText === "RATE_LIMIT_BANNED") {
      coolUntil = Date.now() + 20_000;
      logHttpFailure({ url: upstream, event: "gmgn", source: "gmgn", status: 429, ms, detail: errText || "rate_limit" });
      return null;
    }
    if (!res.ok || !json) {
      if (res.status === 401 || res.status === 403) coolUntil = Date.now() + 60_000;
      logHttpFailure({ url: upstream, event: "gmgn", source: "gmgn", status: res.status, ms, detail: errText || res.statusText });
      return null;
    }
    return json;
  } catch (err) {
    coolUntil = Date.now() + 45_000;
    logHttpFailure({ url: upstream, event: "gmgn", source: "gmgn", err, ms: Date.now() - started });
    return null;
  }
}

async function gmgnGet(path: string, query: Record<string, string | number | undefined>): Promise<GmgnEnvelope | null> {
  return (await gmgnRequest(path, query)) as GmgnEnvelope | null;
}

function num(v: string | number | null | undefined) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fillFromActivity(row: GmgnActivity, trader: Trader): TapeFill | null {
  const kind = (row.event_type || "").toLowerCase();
  if (kind !== "buy" && kind !== "sell") return null;
  const token = row.token?.address;
  if (!token) return null;
  const usd = num(row.cost_usd);
  if (usd > 0 && usd < MIN_USD) return null;
  const symbol = (row.token?.symbol || "???").trim();
  if (STOCK.test(symbol)) return null;
  const chain = chainFromGmgn(row.chain) || "solana";
  const rawTs = row.timestamp || 0;
  const ts = rawTs > 10_000_000_000 ? rawTs : rawTs * 1000;
  if (!ts || Date.now() - ts > MAX_AGE_MS) return null;
  const slug = gmgnSlug(chain) || "sol";
  const name = (row.token?.name || symbol).trim();
  return {
    id: `gmgn-${row.tx_hash || token}-${ts}`,
    ts,
    chain,
    side: kind,
    usd,
    amount: num(row.token_amount),
    price: num(row.price_usd) || null,
    token,
    symbol,
    name: name.toLowerCase() === symbol.toLowerCase() ? symbol : name,
    mcap: null,
    liquidity: null,
    change24: null,
    pairUrl: `https://gmgn.ai/${slug}/token/${token}`,
    imageUrl: row.token?.logo || null,
    wallet: row.wallet || trader.solana || trader.address,
    handle: trader.handle,
    followers: trader.followers,
    profileUrl: trader.profileUrl,
    rank: trader.rank,
    tx: row.tx_hash || null,
    firstBuy: false,
    flags: ["gmgn", ...traderSourceFlags(trader)],
    source: "dexscreener",
    smartKind: trader.kind as SmartKind,
  };
}

type Job = { chain: ChainId; wallet: string; trader: Trader };

let watchCursor = 0;

const CHAINS: ChainId[] = ["solana", "base", "bsc", "ethereum", "robinhood", "monad"];

function followChainOf(trader: Trader): ChainId | null {
  const hit = trader.smartReasons.find((s) => s.startsWith("chain:"));
  if (hit) {
    const id = hit.slice(6) as ChainId;
    if (CHAINS.includes(id)) return id;
  }
  if (trader.solana) return "solana";
  return null;
}

function planJobs(traders: Trader[]): Job[] {
  const bag: Job[] = [];
  const seen = new Set<string>();
  const push = (job: Job) => {
    const k = `${job.chain}:${job.wallet.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    bag.push(job);
  };
  for (const trader of traders) {
    const chain = followChainOf(trader);
    if (chain === "solana" && trader.solana) push({ chain, wallet: trader.solana, trader });
    else if (chain && trader.address) push({ chain, wallet: trader.address, trader });
    else if (trader.solana) push({ chain: "solana", wallet: trader.solana, trader });
  }
  if (!bag.length) {
    const extra = GMGN_FOMO_EVM[evmCursor % GMGN_FOMO_EVM.length];
    evmCursor += 1;
    for (const trader of traders) {
      if (trader.address) push({ chain: extra, wallet: trader.address, trader });
    }
  }
  const jobs: Job[] = [];
  if (!bag.length) return jobs;
  const start = watchCursor % bag.length;
  watchCursor += MAX_JOBS;
  for (let i = 0; i < bag.length && jobs.length < MAX_JOBS; i++) jobs.push(bag[(start + i) % bag.length]);
  return jobs;
}

export async function fetchGmgnWalletTape(traders: Trader[]): Promise<TapeFill[]> {
  if (!gmgnConfigured()) return [];
  const jobs = planJobs(traders);
  if (!jobs.length) return [];
  const out: TapeFill[] = [];
  for (const job of jobs) {
    const slug = gmgnSlug(job.chain);
    if (!slug) continue;
    const raw = await gmgnGet("/v1/user/wallet_activity", { chain: slug, wallet_address: job.wallet, limit: 12 });
    const rows = raw?.data?.activities || raw?.data?.list || [];
    for (const row of rows) {
      const fill = fillFromActivity(row, job.trader);
      if (fill) out.push(fill);
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}
