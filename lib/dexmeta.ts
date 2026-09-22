import type { AlertHit } from "./alert-msg";
import { logHttpFailure } from "./log";
import { dexSlug } from "./gmgn-chain";
import type { ChainId, TapeFill } from "./types";
import { ALERT_MCAP_TTL_MS } from "./window";

export type DexMeta = {
  mcap: number | null;
  liquidity: number | null;
  change24: number | null;
  symbol?: string;
  name?: string;
};

const cache = new Map<string, { at: number; meta: DexMeta }>();
const missUntil = new Map<string, number>();
const TTL = 3 * 60_000;
const MISS_MS = 2 * 60_000;
let lastDexFault = 0;

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

function noteDexFault(url: string, detail: string, status?: number, err?: unknown) {
  if (Date.now() - lastDexFault < 60_000) return;
  lastDexFault = Date.now();
  logHttpFailure({ url, event: "dex", source: "dex", status, detail, err });
}

async function fetchDexBatch(chain: ChainId, tokens: string[]) {
  const slug = dexSlug(chain);
  if (!slug || !tokens.length) return;
  const url = `https://api.dexscreener.com/tokens/v1/${slug}/${tokens.join(",")}`;
  const hold = (ms: number) => {
    const until = Date.now() + ms;
    for (const token of tokens) missUntil.set(key(chain, token), until);
  };
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      hold(res.status === 429 ? 3 * 60_000 : MISS_MS);
      noteDexFault(url, `${tokens.length} token`, res.status);
      return;
    }
    const pairs = (await res.json()) as Pair[];
    const list = Array.isArray(pairs) ? pairs : [];
    for (const token of tokens) {
      const meta = pick(list, token);
      if (meta) cache.set(key(chain, token), { at: Date.now(), meta });
      else missUntil.set(key(chain, token), Date.now() + MISS_MS);
    }
  } catch (err) {
    hold(MISS_MS);
    noteDexFault(url, `${tokens.length} token`, undefined, err);
  }
}

export async function warmDexMeta(pairs: { chain: ChainId; token: string }[], maxAgeMs = TTL) {
  const by = new Map<ChainId, string[]>();
  for (const row of pairs) {
    if (!row.token) continue;
    const k = key(row.chain, row.token);
    const hit = cache.get(k);
    if (hit && Date.now() - hit.at < maxAgeMs) continue;
    if ((missUntil.get(k) || 0) > Date.now()) continue;
    const list = by.get(row.chain) || [];
    if (!list.includes(row.token)) list.push(row.token);
    by.set(row.chain, list);
  }
  for (const [chain, tokens] of by) {
    for (let i = 0; i < tokens.length; i += 30) {
      await fetchDexBatch(chain, tokens.slice(i, i + 30));
    }
  }
}

export async function fetchDexMeta(chain: ChainId, token: string, maxAgeMs = TTL): Promise<DexMeta | null> {
  const k = key(chain, token);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < maxAgeMs) return hit.meta;
  if ((missUntil.get(k) || 0) > Date.now()) return null;
  await fetchDexBatch(chain, [token]);
  return cache.get(k)?.meta ?? null;
}

export async function hydrateHit(hit: AlertHit, maxAgeMs = ALERT_MCAP_TTL_MS): Promise<AlertHit> {
  const meta = await fetchDexMeta(hit.chain, hit.token, maxAgeMs);
  if (!meta) return hit;
  return {
    ...hit,
    mcap: meta.mcap ?? hit.mcap,
    liquidity: meta.liquidity ?? hit.liquidity,
    change24: meta.change24 ?? hit.change24,
    symbol: hit.symbol && hit.symbol !== "???" ? hit.symbol : meta.symbol || hit.symbol,
    name: hit.name || meta.name,
  };
}

export function overlayCachedDex(rows: TapeFill[]): TapeFill[] {
  return rows.map((row) => {
    const meta = cache.get(key(row.chain, row.token))?.meta;
    if (!meta) return row;
    const symbol = row.symbol && row.symbol !== "???" ? row.symbol : meta.symbol || row.symbol;
    const name = meta.name && meta.name !== symbol ? meta.name : row.name;
    return {
      ...row,
      mcap: meta.mcap ?? row.mcap,
      liquidity: meta.liquidity ?? row.liquidity,
      change24: meta.change24 ?? row.change24,
      symbol,
      name: name && name !== symbol && isQuoteish(name) ? symbol : name,
    };
  });
}

function isQuoteish(raw: string) {
  const s = raw.replace(/^\$/, "").trim().toUpperCase();
  return /^(WSOL|WETH|WBNB|WBTC|SOL|ETH|BNB|USDC|USDT|USD1|JUP|HYPE|FWOG|GIGA|BONK)$/.test(s);
}

export async function hydrateFills(rows: TapeFill[], limit = 36, maxAgeMs = TTL): Promise<TapeFill[]> {
  const seen = new Set<string>();
  const unique: TapeFill[] = [];
  for (const row of rows) {
    const k = key(row.chain, row.token);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(row);
  }
  await warmDexMeta(unique.slice(0, limit), maxAgeMs);
  return overlayCachedDex(rows);
}
