import type { ChainId, SmartKind, TapeFill, Trader } from "./types";

const HOST = "https://openapi.gmgn.ai";
const DEMO_KEY = "gmgn_solbscbaseethmonadtron";
const MIN_GAP_MS = 850;
const MAX_JOBS = 8;
const MIN_USD = 8;

/** FOMO app ∩ GMGN OpenAPI */
export const GMGN_FOMO_EVM: ChainId[] = ["robinhood", "base", "bsc", "ethereum", "monad"];

export function gmgnApiKey() {
  return process.env.GMGN_API_KEY || DEMO_KEY;
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
  reset_at?: number;
  data?: { activities?: GmgnActivity[]; list?: GmgnActivity[] };
};

let lastAt = 0;
let evmCursor = 0;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function gate() {
  const wait = MIN_GAP_MS - (Date.now() - lastAt);
  if (wait > 0) await sleep(wait);
  lastAt = Date.now();
}

async function gmgnGet(path: string, query: Record<string, string | number | undefined>): Promise<GmgnEnvelope | null> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  params.set("timestamp", String(Math.floor(Date.now() / 1000)));
  params.set("client_id", crypto.randomUUID());
  await gate();
  const res = await fetch(`${HOST}${path}?${params.toString()}`, {
    headers: { "X-APIKEY": gmgnApiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as GmgnEnvelope | null;
  if (res.status === 429 || json?.error === "RATE_LIMIT_EXCEEDED" || json?.error === "RATE_LIMIT_BANNED") {
    const reset = json?.reset_at ? json.reset_at * 1000 : Date.now() + 4000;
    const pause = Math.min(Math.max(reset - Date.now(), 1500), 8000);
    await sleep(pause);
    return null;
  }
  if (!res.ok || !json) return null;
  return json;
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
  const chain = chainFromGmgn(row.chain) || "solana";
  const ts = row.timestamp || 0;
  const slug = gmgnSlug(chain) || "sol";
  return {
    id: `gmgn-${row.tx_hash || token}-${ts}`,
    ts: ts > 10_000_000_000 ? ts : ts * 1000,
    chain,
    side: kind,
    usd,
    amount: num(row.token_amount),
    price: num(row.price_usd) || null,
    token,
    symbol: row.token?.symbol || "???",
    name: row.token?.name || row.token?.symbol || "token",
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
    flags: [trader.kind, "gmgn"],
    source: "dexscreener",
    smartKind: trader.kind as SmartKind,
  };
}

type Job = { chain: ChainId; wallet: string; trader: Trader };

function planJobs(traders: Trader[]): Job[] {
  const watched = traders.filter((t) => t.kind === "kol" || t.kind === "smart").slice(0, 6);
  const extra = GMGN_FOMO_EVM[evmCursor % GMGN_FOMO_EVM.length];
  evmCursor += 1;
  const jobs: Job[] = [];
  const seen = new Set<string>();
  const push = (job: Job) => {
    const key = `${job.chain}:${job.wallet.toLowerCase()}`;
    if (seen.has(key) || jobs.length >= MAX_JOBS) return;
    seen.add(key);
    jobs.push(job);
  };
  for (const trader of watched) {
    if (trader.solana) push({ chain: "solana", wallet: trader.solana, trader });
  }
  for (const trader of watched) {
    if (trader.address) push({ chain: extra, wallet: trader.address, trader });
  }
  return jobs;
}

export async function fetchGmgnWalletTape(traders: Trader[]): Promise<TapeFill[]> {
  const jobs = planJobs(traders);
  if (!jobs.length) return [];
  const out: TapeFill[] = [];
  for (const job of jobs) {
    const slug = gmgnSlug(job.chain);
    if (!slug) continue;
    const raw = await gmgnGet("/v1/user/wallet_activity", {
      chain: slug,
      wallet_address: job.wallet,
      limit: 15,
    });
    const rows = raw?.data?.activities || raw?.data?.list || [];
    for (const row of rows) {
      const fill = fillFromActivity(row, job.trader);
      if (fill) out.push(fill);
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}
