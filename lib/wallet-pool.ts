import { KNOWN_WALLETS } from "./known";
import { persistGet, persistSet } from "./persist";
import type { ChainId, TapeFill, Trader } from "./types";
import { isEvmWallet, isSolWallet } from "./watchlist";

/** One row per address. Solana and EVM never share a row. */
export type WalletSource =
  | "nansen"
  | "binance"
  | "pulse"
  | "fomo"
  | "pump"
  | "cabal"
  | "madeon"
  | "soltrack"
  | "gmgn"
  | "tape"
  | "known"
  | "watch";

export type PoolWallet = {
  family: "solana" | "evm";
  address: string;
  handle: string;
  chains: ChainId[];
  sources: WalletSource[];
  primary: WalletSource;
  seenAt: number;
};

export type WalletSeed = {
  address: string;
  chain?: ChainId | null;
  handle?: string | null;
  source: WalletSource;
  seenAt?: number;
};

const KEY = "eg_wallet_pool_v1";
const MAX = 5000;

/** Lower index stays when the pool is over the cap. */
const RANK: WalletSource[] = [
  "nansen",
  "binance",
  "pulse",
  "fomo",
  "pump",
  "cabal",
  "madeon",
  "soltrack",
  "gmgn",
  "tape",
  "known",
  "watch",
];

const EVM_CHAINS: ChainId[] = [
  "base",
  "bsc",
  "ethereum",
  "robinhood",
  "monad",
  "arbitrum",
  "hyperevm",
  "megaeth",
  "xlayer",
  "stable",
  "arc",
];

export function sourceRank(source: WalletSource) {
  const i = RANK.indexOf(source);
  return i === -1 ? RANK.length : i;
}

export function asPoolChain(raw: string | null | undefined): ChainId | null {
  if (raw === "solana") return "solana";
  if (raw && EVM_CHAINS.includes(raw as ChainId)) return raw as ChainId;
  return null;
}

function identity(address: string): { family: "solana" | "evm"; address: string } | null {
  const raw = address.trim();
  if (isSolWallet(raw)) return { family: "solana", address: raw };
  if (isEvmWallet(raw)) return { family: "evm", address: raw.toLowerCase() };
  return null;
}

export function poolKey(family: "solana" | "evm", address: string) {
  return `${family}:${address}`;
}

function stubHandle(handle: string, address: string) {
  const h = handle.replace(/^@/, "").trim();
  if (!h) return true;
  const hl = h.toLowerCase();
  const al = address.toLowerCase();
  if (hl === al) return true;
  if (al.startsWith(hl) && h.length <= 8) return true;
  return false;
}

function betterHandle(prev: string, next: string, address: string, preferNext: boolean) {
  const incoming = next.replace(/^@/, "").trim();
  if (!incoming) return prev;
  const prevStub = stubHandle(prev, address);
  const nextStub = stubHandle(incoming, address);
  if (prevStub && !nextStub) return incoming;
  if (!prevStub && nextStub) return prev;
  if (preferNext && !nextStub) return incoming;
  return prev || incoming;
}

function addChain(row: PoolWallet, chain: ChainId | null) {
  if (!chain || chain === "unknown") return;
  if (row.family === "solana") {
    if (chain === "solana" && !row.chains.includes("solana")) row.chains.push("solana");
    return;
  }
  if (chain === "solana" || !EVM_CHAINS.includes(chain)) return;
  if (!row.chains.includes(chain)) row.chains.push(chain);
}

function blank(id: { family: "solana" | "evm"; address: string }, source: WalletSource, seenAt: number): PoolWallet {
  const row: PoolWallet = {
    family: id.family,
    address: id.address,
    handle: id.address.slice(0, 8),
    chains: [],
    sources: [source],
    primary: source,
    seenAt,
  };
  if (id.family === "solana") row.chains = ["solana"];
  return row;
}

export function mergeWalletSeeds(prev: PoolWallet[], seeds: WalletSeed[], now = Date.now()): PoolWallet[] {
  const map = new Map<string, PoolWallet>();
  for (const row of prev) {
    const id = identity(row.address);
    if (!id || id.family !== row.family) continue;
    const chains = (row.chains || []).map((c) => asPoolChain(c)).filter((c): c is ChainId => Boolean(c));
    const next: PoolWallet = {
      ...row,
      address: id.address,
      chains: id.family === "solana" ? ["solana"] : [...new Set(chains.filter((c) => c !== "solana"))],
      sources: row.sources?.length ? [...row.sources] : [row.primary],
      handle: row.handle || id.address.slice(0, 8),
      primary: row.primary || "tape",
      seenAt: row.seenAt || 0,
    };
    map.set(poolKey(id.family, id.address), next);
  }
  for (const seed of seeds) {
    const id = identity(seed.address || "");
    if (!id) continue;
    const seenAt = seed.seenAt && seed.seenAt > 0 ? seed.seenAt : now;
    const key = poolKey(id.family, id.address);
    let row = map.get(key);
    if (!row) {
      row = blank(id, seed.source, seenAt);
      map.set(key, row);
    }
    const prefer = sourceRank(seed.source) < sourceRank(row.primary);
    row.handle = betterHandle(row.handle, seed.handle || "", row.address, prefer);
    row.seenAt = Math.max(row.seenAt || 0, seenAt);
    if (!row.sources.includes(seed.source)) row.sources.push(seed.source);
    if (prefer) row.primary = seed.source;
    const chain = id.family === "solana" ? "solana" : asPoolChain(seed.chain);
    addChain(row, chain);
  }
  const ranked = [...map.values()].sort((a, b) => sourceRank(a.primary) - sourceRank(b.primary) || b.seenAt - a.seenAt);
  return ranked.slice(0, MAX).sort((a, b) => b.seenAt - a.seenAt);
}

function loadRaw(): PoolWallet[] {
  try {
    const raw = JSON.parse(persistGet(KEY) || "null") as { wallets?: PoolWallet[] } | null;
    if (!raw || !Array.isArray(raw.wallets)) return [];
    return raw.wallets.filter((row) => row && (row.family === "solana" || row.family === "evm") && row.address);
  } catch {
    return [];
  }
}

function commit(next: PoolWallet[]) {
  const raw = JSON.stringify({ wallets: next });
  if (raw === persistGet(KEY)) return next;
  persistSet(KEY, raw);
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eg-wallets"));
  return next;
}

export function readWalletPool(): PoolWallet[] {
  const out: PoolWallet[] = [];
  for (const row of loadRaw()) {
    const id = identity(row.address);
    if (!id || id.family !== row.family) continue;
    const chains = (row.chains || []).map((c) => asPoolChain(c)).filter((c): c is ChainId => Boolean(c));
    out.push({
      ...row,
      address: id.address,
      family: id.family,
      chains: id.family === "solana" ? ["solana"] : [...new Set(chains.filter((c) => c !== "solana"))],
      sources: row.sources?.length ? row.sources : [row.primary || "tape"],
      primary: row.primary || "tape",
      handle: row.handle || id.address.slice(0, 8),
      seenAt: row.seenAt || 0,
    });
  }
  return out.sort((a, b) => (b.seenAt || 0) - (a.seenAt || 0));
}

export function noteWallets(seeds: WalletSeed[]) {
  if (!seeds.length) return readWalletPool();
  return commit(mergeWalletSeeds(loadRaw(), seeds));
}

export function sourceOfFill(fill: TapeFill): WalletSource {
  const flags = new Set((fill.flags || []).map((f) => f.toLowerCase()));
  if (flags.has("nansen")) return "nansen";
  if (flags.has("binance")) return "binance";
  if (flags.has("fomoapi")) return "fomo";
  if (flags.has("cabalspy")) return "cabal";
  if (flags.has("madeonsol")) return "madeon";
  if (flags.has("soltrack")) return "soltrack";
  if (flags.has("pumpfun") || flags.has("pump")) return "pump";
  if (flags.has("gmgn") || flags.has("follow") || flags.has("track")) return "gmgn";
  if (fill.source === "fomopulse" || flags.has("fomopulse") || fill.chain === "robinhood") return "pulse";
  return "tape";
}

export function noteTapeFills(fills: TapeFill[]) {
  const seeds: WalletSeed[] = [];
  for (const fill of fills) {
    if (!fill.wallet) continue;
    seeds.push({
      address: fill.wallet,
      chain: fill.chain,
      handle: fill.handle,
      source: sourceOfFill(fill),
      seenAt: fill.ts || Date.now(),
    });
  }
  return noteWallets(seeds);
}

export function sourceOfTrader(t: Trader): WalletSource {
  const srcs = t.smartReasons.filter((s) => s.startsWith("src:")).map((s) => s.slice(4));
  const has = (name: string) => srcs.some((s) => s === name || s.startsWith(`${name}:`));
  if (has("nansen")) return "nansen";
  if (has("binance")) return "binance";
  if (has("pumpfun") || has("pump")) return "pump";
  if (has("cabalspy")) return "cabal";
  if (has("madeonsol")) return "madeon";
  if (has("soltrack")) return "soltrack";
  if (has("gmgn") || has("follow") || has("track")) return "gmgn";
  if (has("fomo") || has("fomoapi")) return "fomo";
  if (has("watch")) return "watch";
  return "pulse";
}

function traderChain(t: Trader): ChainId | null {
  const tagged = t.smartReasons.find((s) => s.startsWith("chain:"));
  if (tagged) return asPoolChain(tagged.slice(6));
  const extra = t.smartReasons.find((s) => s.startsWith("src:extra:"));
  if (extra) return asPoolChain(extra.slice("src:extra:".length));
  return null;
}

export function noteTraders(traders: Trader[]) {
  const seeds: WalletSeed[] = [];
  const now = Date.now();
  for (const t of traders) {
    const source = sourceOfTrader(t);
    const chain = traderChain(t);
    const handle = t.handle || t.displayName;
    if (t.solana) {
      seeds.push({ address: t.solana, chain: "solana", handle, source, seenAt: t.lastTs || now });
    }
    if (t.address) {
      const evmChain = chain && chain !== "solana" ? chain : source === "pulse" ? "robinhood" : null;
      seeds.push({ address: t.address, chain: evmChain, handle, source, seenAt: t.lastTs || now });
    }
  }
  return noteWallets(seeds);
}

export function noteKnownWallets() {
  const seeds: WalletSeed[] = [];
  for (const [handle, row] of Object.entries(KNOWN_WALLETS)) {
    if (row.solana) seeds.push({ address: row.solana, chain: "solana", handle, source: "known" });
    if (row.evm) seeds.push({ address: row.evm, chain: null, handle, source: "known" });
  }
  return noteWallets(seeds);
}

export function clearWalletPool() {
  return commit([]);
}

export function walletPoolStats(rows = readWalletPool()) {
  let sol = 0;
  let evm = 0;
  let chainless = 0;
  const byChain = new Map<string, number>();
  for (const row of rows) {
    if (row.family === "solana") {
      sol += 1;
      byChain.set("solana", (byChain.get("solana") || 0) + 1);
      continue;
    }
    evm += 1;
    if (!row.chains.length) {
      chainless += 1;
      byChain.set("evm", (byChain.get("evm") || 0) + 1);
      continue;
    }
    for (const chain of row.chains) byChain.set(chain, (byChain.get(chain) || 0) + 1);
  }
  return { total: rows.length, sol, evm, chainless, byChain };
}
