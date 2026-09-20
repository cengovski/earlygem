import type { AlertHit } from "./alert-msg";
import type { ChainId, TapeFill } from "./types";

export type DexMeta = {
  mcap: number | null;
  liquidity: number | null;
  change24: number | null;
  symbol?: string;
  name?: string;
};

const cache = new Map<string, { at: number; meta: DexMeta }>();
const TTL = 3 * 60_000;

type Pair = {
  chainId?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
  baseToken?: { address?: string; symbol?: string; name?: string };
};

function key(chain: string, token: string) {
  return `${chain}:${token.toLowerCase()}`;
}

function pick(pairs: Pair[], token: string): DexMeta | null {
  const want = token.toLowerCase();
  const mine = pairs.filter((p) => (p.baseToken?.address || "").toLowerCase() === want);
  const bag = mine.length ? mine : pairs;
  if (!bag.length) return null;
  bag.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
  const top = bag[0];
  const mcap = top.marketCap || top.fdv || null;
  return {
    mcap: mcap && mcap > 0 ? mcap : null,
    liquidity: top.liquidity?.usd && top.liquidity.usd > 0 ? top.liquidity.usd : null,
    change24: typeof top.priceChange?.h24 === "number" ? top.priceChange.h24 : null,
    symbol: top.baseToken?.symbol,
    name: top.baseToken?.name,
  };
}

export async function fetchDexMeta(chain: ChainId, token: string): Promise<DexMeta | null> {
  const k = key(chain, token);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < TTL) return hit.meta;
  try {
    const res = await fetch(`https://api.dexscreener.com/tokens/v1/${chain}/${token}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return null;
    const pairs = (await res.json()) as Pair[];
    const meta = Array.isArray(pairs) ? pick(pairs, token) : null;
    if (meta) cache.set(k, { at: Date.now(), meta });
    return meta;
  } catch {
    return null;
  }
}

export async function hydrateHit(hit: AlertHit): Promise<AlertHit> {
  if (hit.mcap && hit.liquidity && hit.change24 != null) return hit;
  const meta = await fetchDexMeta(hit.chain, hit.token);
  if (!meta) return hit;
  return {
    ...hit,
    mcap: hit.mcap || meta.mcap,
    liquidity: hit.liquidity || meta.liquidity,
    change24: hit.change24 ?? meta.change24,
    symbol: hit.symbol && hit.symbol !== "???" ? hit.symbol : meta.symbol || hit.symbol,
    name: hit.name || meta.name,
  };
}

export async function hydrateFills(rows: TapeFill[], limit = 24): Promise<TapeFill[]> {
  const need = rows.filter((r) => !r.mcap).slice(0, limit);
  const seen = new Set<string>();
  const jobs: TapeFill[] = [];
  for (const row of need) {
    const k = key(row.chain, row.token);
    if (seen.has(k)) continue;
    seen.add(k);
    jobs.push(row);
  }
  const metas = await Promise.all(jobs.map((row) => fetchDexMeta(row.chain, row.token)));
  const byKey = new Map<string, DexMeta>();
  jobs.forEach((row, i) => {
    if (metas[i]) byKey.set(key(row.chain, row.token), metas[i]!);
  });
  return rows.map((row) => {
    const meta = byKey.get(key(row.chain, row.token));
    if (!meta) return row;
    return {
      ...row,
      mcap: row.mcap || meta.mcap,
      liquidity: row.liquidity || meta.liquidity,
      change24: row.change24 ?? meta.change24,
    };
  });
}
