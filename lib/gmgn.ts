import { traderSourceFlags } from "./alert-msg";
import { gmgnLaneKeys, loadClientKeys } from "./client-keys";
import { persistGet, persistSet } from "./persist";
import { gmgnAuthQuery, gmgnSign, gmgnSignMessage } from "./gmgn-sign";
import { logEvent, logHttpFailure } from "./log";
import type { ChainId, SmartKind, TapeFill, Trader } from "./types";

const HOST = "https://openapi.gmgn.ai";
const MIN_GAP_MS = 1_200;
const COOL_EXCEEDED_MS = 3 * 60_000;
const COOL_BANNED_MS = 12 * 60_000;
/** wallet_activity jobs when follow PEM yok; every other 25s tick. */
const FOLLOW_JOBS = 3;
const MIN_USD = 8;
const MAX_AGE_MS = 8 * 60 * 60 * 1000;
const STOCK = /^(googlb?|gmeb?|qqqb?|nvdab?|tslab?|aaplb?|msftb?|metab?|amznb?|gstock|sndk|qqq|spy|iwm)$/i;

export const GMGN_FOMO_EVM: ChainId[] = ["robinhood", "base", "bsc", "ethereum", "monad"];

type Lane = "vps" | "pc";

export function gmgnApiKey() {
  const lanes = gmgnLaneKeys();
  return lanes.pc || lanes.vps;
}

export function gmgnConfigured() {
  return Boolean(gmgnApiKey());
}

export function gmgnPrivateKey() {
  const row = loadClientKeys();
  return (row.gmgnPem || process.env.GMGN_PRIVATE_KEY || "").trim();
}

export function gmgnFollowConfigured() {
  return Boolean(gmgnApiKey() && gmgnPrivateKey());
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

const lastAt: Record<Lane, number> = { vps: 0, pc: 0 };
const coolUntil: Record<Lane, number> = { vps: 0, pc: 0 };
const COOL_KEY = "eg_gmgn_cool";
let coolLoaded = false;
let turn = 0;
let evmCursor = 0;
let chainLock: Promise<void> = Promise.resolve();

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = chainLock.then(fn, fn);
  chainLock = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

async function gate(lane: Lane) {
  const wait = MIN_GAP_MS - (Date.now() - lastAt[lane]);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastAt[lane] = Date.now();
}

function loadCool() {
  if (coolLoaded) return;
  coolLoaded = true;
  try {
    const raw = JSON.parse(persistGet(COOL_KEY) || "null") as { pc?: number; vps?: number } | null;
    if (!raw) return;
    coolUntil.pc = Math.max(coolUntil.pc, Number(raw.pc) || 0);
    coolUntil.vps = Math.max(coolUntil.vps, Number(raw.vps) || 0);
  } catch {
    /* ignore */
  }
}

function saveCool() {
  persistSet(COOL_KEY, JSON.stringify({ pc: coolUntil.pc, vps: coolUntil.vps }));
}

function cool(lane: Lane, ms: number) {
  loadCool();
  coolUntil[lane] = Math.max(coolUntil[lane], Date.now() + ms);
  saveCool();
}

function coolAccount(ms: number) {
  loadCool();
  const until = Date.now() + ms;
  coolUntil.pc = Math.max(coolUntil.pc, until);
  coolUntil.vps = Math.max(coolUntil.vps, until);
  saveCool();
}

function proxyBase() {
  const custom = gmgnLaneKeys().proxy;
  if (custom) return custom;
  if (typeof window !== "undefined") return "/api/gmgn";
  return "";
}

function laneReady(lane: Lane) {
  loadCool();
  if (Date.now() < coolUntil[lane]) return false;
  if (!gmgnLaneKeys()[lane]) return false;
  if (lane === "vps" && !proxyBase() && typeof window === "undefined") return false;
  return true;
}

function laneOrder(prefer?: Lane): Lane[] {
  const first: Lane = prefer ?? (turn++ % 2 === 0 ? "vps" : "pc");
  const next: Lane[] = first === "pc" ? ["pc", "vps"] : ["vps", "pc"];
  return next.filter(laneReady);
}

function gmgnTradeList(json: Record<string, unknown> | null | undefined): unknown[] {
  if (!json) return [];
  if (Array.isArray(json.list)) return json.list as unknown[];
  const data = json.data;
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    const row = data as Record<string, unknown>;
    if (Array.isArray(row.list)) return row.list as unknown[];
    if (Array.isArray(row.activities)) return row.activities as unknown[];
  }
  return [];
}

function coolMs(json: Record<string, unknown> | null, banned: boolean) {
  const floor = banned ? COOL_BANNED_MS : COOL_EXCEEDED_MS;
  const raw = Number(json?.reset_at);
  let wait = floor;
  if (Number.isFinite(raw) && raw > 0) {
    const until = raw > 10_000_000_000 ? raw : raw * 1000;
    wait = Math.max(until - Date.now() + 1_000, floor);
  }
  return Math.min(wait, COOL_BANNED_MS);
}

export function gmgnCooling() {
  return !laneReady("vps") && !laneReady("pc");
}

export function gmgnRateCooling() {
  loadCool();
  return Date.now() < coolUntil.vps || Date.now() < coolUntil.pc;
}

/** Signed Track prefers PC. EXCEEDED cools both keys (same GMGN account bucket). BANNED is per-IP and may fall through. */
export async function gmgnRequest(
  path: string,
  query: Record<string, string | number | undefined>,
  opts?: { sign?: boolean },
): Promise<Record<string, unknown> | null> {
  if (!gmgnConfigured()) return null;
  if (opts?.sign && !gmgnPrivateKey()) {
    logEvent({
      level: "warn",
      event: "gmgn",
      outcome: "error",
      source: "gmgn",
      detail: "follow_wallet için GMGN private PEM yok",
    });
    return null;
  }
  return serialize(async () => {
    const lanes = laneOrder(opts?.sign ? "pc" : undefined);
    for (const lane of lanes) {
      const auth = gmgnAuthQuery();
      const params = new URLSearchParams();
      const queryMap: Record<string, string> = { ...auth };
      for (const [k, value] of Object.entries(query)) {
        if (value == null || value === "") continue;
        queryMap[k] = String(value);
      }
      for (const [k, value] of Object.entries(queryMap)) params.set(k, value);
      let signature = "";
      if (opts?.sign) {
        try {
          const msg = gmgnSignMessage(path, queryMap, "", auth.timestamp);
          signature = await gmgnSign(gmgnPrivateKey(), msg);
        } catch (err) {
          logHttpFailure({
            url: `${HOST}${path}`,
            event: "gmgn",
            source: "gmgn",
            err,
            detail: "follow_wallet imza",
          });
          return null;
        }
      }
      const json = await hitLane(lane, path, params, signature);
      if (json === "rate" || json === "banned") return null;
      if (json && typeof json === "object") return json;
    }
    return null;
  });
}

async function hitLane(lane: Lane, path: string, params: URLSearchParams, signature = ""): Promise<Record<string, unknown> | "rate" | "banned" | null> {
  const key = gmgnLaneKeys()[lane];
  if (!key) return null;
  await gate(lane);
  const upstream = `${HOST}${path}?${params.toString()}`;
  const viaProxy = lane === "vps";
  const proxy = proxyBase();
  const url = viaProxy && proxy ? `${proxy}?path=${encodeURIComponent(path)}&${params.toString()}` : upstream;
  const started = Date.now();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (viaProxy && proxy) {
      headers["x-eg-gmgn"] = key;
      if (signature) headers["x-eg-gmgn-sig"] = signature;
    } else {
      headers["X-APIKEY"] = key;
      if (signature) headers["X-Signature"] = signature;
    }
    const res = await fetch(url, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const ms = Date.now() - started;
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    const errText = typeof json?.error === "string" ? json.error : "";
    const tag = `${lane} ${viaProxy ? "proxy" : "direct"}`;
    if (res.status === 429 || errText === "RATE_LIMIT_EXCEEDED" || errText === "RATE_LIMIT_BANNED") {
      const banned = errText === "RATE_LIMIT_BANNED";
      const wait = coolMs(json, banned);
      coolAccount(wait);
      logHttpFailure({
        url: upstream,
        event: "gmgn",
        source: "gmgn",
        status: 429,
        ms,
        detail: `${tag} ${errText || "rate_limit"} · ${Math.round(wait / 60000)}dk soğuma${banned ? "" : " · hesap"}`,
      });
      return banned ? "banned" : "rate";
    }
    const apiCode = json?.code;
    if (apiCode != null && apiCode !== 0 && apiCode !== "0") {
      if (res.status === 401 || res.status === 403) cool(lane, 60_000);
      else cool(lane, 15_000);
      logHttpFailure({
        url: upstream,
        event: "gmgn",
        source: "gmgn",
        status: res.status,
        ms,
        detail: `${tag} code=${String(apiCode)} ${errText || String(json?.message || "")}`.trim(),
      });
      return null;
    }
    if (!res.ok || !json) {
      if (res.status === 401 || res.status === 403) cool(lane, 60_000);
      else cool(lane, 15_000);
      logHttpFailure({ url: upstream, event: "gmgn", source: "gmgn", status: res.status, ms, detail: `${tag} ${errText || res.statusText}` });
      return null;
    }
    return json;
  } catch (err) {
    const ms = Date.now() - started;
    const msg = err instanceof Error ? err.message : "fail";
    cool(lane, /failed to fetch/i.test(msg) ? 120_000 : 20_000);
    logHttpFailure({ url: upstream, event: "gmgn", source: "gmgn", err, ms, detail: `${lane} ${viaProxy ? "proxy" : "direct"}` });
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
  const groups = new Map<ChainId, Job[]>();
  const seen = new Set<string>();
  const push = (job: Job) => {
    const k = `${job.chain}:${job.wallet.toLowerCase()}`;
    if (seen.has(k)) return;
    seen.add(k);
    const bag = groups.get(job.chain) || [];
    bag.push(job);
    groups.set(job.chain, bag);
  };
  for (const trader of traders) {
    const chain = followChainOf(trader);
    if (chain === "solana" && trader.solana) push({ chain, wallet: trader.solana, trader });
    else if (chain && trader.address) push({ chain, wallet: trader.address, trader });
    else if (trader.solana) push({ chain: "solana", wallet: trader.solana, trader });
  }
  if (!groups.size) {
    const extra = GMGN_FOMO_EVM[evmCursor % GMGN_FOMO_EVM.length];
    evmCursor += 1;
    for (const trader of traders) {
      if (trader.address) push({ chain: extra, wallet: trader.address, trader });
    }
  }
  const columns = [...groups.values()];
  const bag: Job[] = [];
  const depth = Math.max(0, ...columns.map((c) => c.length));
  for (let i = 0; i < depth; i++) {
    for (const col of columns) {
      if (col[i]) bag.push(col[i]);
    }
  }
  const jobs: Job[] = [];
  if (!bag.length) return jobs;
  const start = watchCursor % bag.length;
  watchCursor += FOLLOW_JOBS;
  for (let i = 0; i < bag.length && jobs.length < FOLLOW_JOBS; i++) jobs.push(bag[(start + i) % bag.length]);
  return jobs;
}

export async function fetchGmgnWalletTape(traders: Trader[]): Promise<TapeFill[]> {
  if (!gmgnConfigured()) return [];
  const jobs = planJobs(traders);
  if (!jobs.length) return [];
  logEvent({
    level: "info",
    event: "gmgn_follow",
    outcome: "ok",
    source: "gmgn",
    count: jobs.length,
    detail: `wallet_activity ${jobs.length} · kuyruk ${traders.length}`,
  });
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

type FollowRow = {
  chain?: string;
  transaction_hash?: string;
  maker?: string;
  side?: string;
  amount_usd?: number;
  token_amount?: number;
  base_amount?: number | string;
  price_usd?: number;
  timestamp?: number;
  base_address?: string;
  base_token?: { symbol?: string; name?: string; logo?: string; launchpad?: string };
  maker_info?: { twitter_username?: string; name?: string; tags?: string[] };
};

const FOLLOW_CHAINS: ChainId[] = ["solana", "solana", "solana", "bsc", "solana", "base", "solana", "ethereum"];
let followCursor = 0;

function fillFromFollow(row: FollowRow, chain: ChainId): TapeFill | null {
  const side = (row.side || "").toLowerCase();
  if (side !== "buy" && side !== "sell") return null;
  const token = row.base_address;
  if (!token) return null;
  const usd = Number(row.amount_usd || 0);
  if (usd > 0 && usd < MIN_USD) return null;
  const raw = row.timestamp || 0;
  const ts = raw > 10_000_000_000 ? raw : raw * 1000;
  if (!ts || Date.now() - ts > MAX_AGE_MS) return null;
  const symbol = (row.base_token?.symbol || "???").trim();
  if (STOCK.test(symbol)) return null;
  const slug = gmgnSlug(chain) || "sol";
  const handle =
    row.maker_info?.twitter_username || row.maker_info?.name || (row.maker || "").slice(0, 8) || "wallet";
  const tags = (row.maker_info?.tags || []).map((t) => t.toLowerCase());
  const name = (row.base_token?.name || symbol).trim();
  const wallet = row.maker || null;
  return {
    id: `gmgn-follow-${row.transaction_hash || token}-${ts}`,
    ts,
    chain,
    side,
    usd,
    amount: num(row.token_amount ?? row.base_amount),
    price: Number(row.price_usd || 0) || null,
    token,
    symbol,
    name: name.toLowerCase() === symbol.toLowerCase() ? symbol : name,
    mcap: null,
    liquidity: null,
    change24: null,
    pairUrl: `https://gmgn.ai/${slug}/token/${token}`,
    imageUrl: row.base_token?.logo || null,
    wallet,
    handle,
    followers: null,
    profileUrl: row.maker_info?.twitter_username ? `https://x.com/${row.maker_info.twitter_username}` : null,
    rank: null,
    tx: row.transaction_hash || null,
    firstBuy: false,
    flags: ["gmgn", "follow", ...tags, ...(row.base_token?.launchpad ? [row.base_token.launchpad] : [])],
    source: "dexscreener",
    smartKind: tags.includes("kol") || tags.includes("renowned") ? "kol" : "smart",
  };
}

/** Live Track: `gmgn-cli track follow-wallet` = GET /v1/trade/follow_wallet (API key account). */
export async function fetchGmgnFollowTape(): Promise<TapeFill[]> {
  if (!gmgnFollowConfigured()) return [];
  const chain = FOLLOW_CHAINS[followCursor % FOLLOW_CHAINS.length];
  followCursor += 1;
  const slug = gmgnSlug(chain);
  if (!slug) return [];
  const raw = await gmgnRequest("/v1/trade/follow_wallet", { chain: slug, limit: 50 }, { sign: true });
  const rows = gmgnTradeList(raw) as FollowRow[];
  const out: TapeFill[] = [];
  for (const row of rows) {
    const fill = fillFromFollow(row, chainFromGmgn(row.chain) || chain);
    if (fill) out.push(fill);
  }
  out.sort((a, b) => b.ts - a.ts);
  logEvent({
    level: out.length ? "info" : "warn",
    event: "gmgn_follow",
    outcome: out.length ? "ok" : "empty",
    source: "gmgn",
    count: out.length,
    detail: `track follow_wallet ${chain} · ${out.length} fill`,
  });
  return out;
}

