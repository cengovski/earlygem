import { logEvent } from "./log";
import type { ChainId } from "./types";

/** GMGN `n` / URL slug → tape chain. Exact tokens only; `eth` must not swallow megaeth. */
const EXACT: Record<string, ChainId> = {
  sol: "solana",
  solana: "solana",
  bsc: "bsc",
  bnb: "bsc",
  base: "base",
  eth: "ethereum",
  ethereum: "ethereum",
  rh: "robinhood",
  rhood: "robinhood",
  robinhood: "robinhood",
  monad: "monad",
  mon: "monad",
  arb: "arbitrum",
  arbitrum: "arbitrum",
  hyper: "hyperevm",
  hype: "hyperevm",
  hyperevm: "hyperevm",
  mega: "megaeth",
  megaeth: "megaeth",
  xlayer: "xlayer",
  okx: "xlayer",
  stable: "stable",
  arc: "arc",
};

const LABELS: Record<ChainId, string> = {
  robinhood: "RH",
  solana: "SOL",
  base: "BASE",
  bsc: "BSC",
  ethereum: "ETH",
  monad: "MON",
  arbitrum: "ARB",
  hyperevm: "HYPER",
  megaeth: "MEGA",
  xlayer: "XLAYER",
  stable: "STABLE",
  arc: "ARC",
  unknown: "?",
};

export function chainLabelOf(chain: ChainId): string {
  return LABELS[chain] || "?";
}

export function resolveGmgnChain(raw: string | undefined | null): ChainId | null {
  const s = String(raw || "").toLowerCase().trim();
  if (!s || s === "0" || s === "unknown" || s === "?") return null;
  if (EXACT[s]) return EXACT[s];
  const parts = s.split(/[^a-z0-9]+/).filter(Boolean);
  for (const part of parts) {
    if (EXACT[part]) return EXACT[part];
  }
  return null;
}

/** DexScreener path. `unknown` has no market. */
export function dexSlug(chain: ChainId): string | null {
  if (chain === "unknown") return null;
  return chain;
}

/** gmgn.ai/{slug}/token/… */
export function gmgnChainSlug(chain: ChainId): string {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "arbitrum") return "arb";
  if (chain === "hyperevm") return "hyper";
  if (chain === "unknown") return "sol";
  return chain;
}

type DexPair = {
  chainId?: string;
  liquidity?: { usd?: number };
  baseToken?: { address?: string };
};

/** Highest-liquidity pair chain for each address. One request, up to 30 tokens. */
export async function detectDexChains(tokens: string[]): Promise<Map<string, ChainId>> {
  const out = new Map<string, ChainId>();
  const uniq = [...new Set(tokens.map((t) => t.trim()).filter(Boolean))].slice(0, 30);
  if (!uniq.length) return out;
  const url = `https://api.dexscreener.com/latest/dex/tokens/${uniq.join(",")}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
    if (!res.ok) {
      logEvent({
        level: "warn",
        event: "gmgn_chain",
        outcome: "error",
        source: "dex",
        status: res.status,
        url,
        detail: `ağ tespiti ${uniq.length} token`,
      });
      return out;
    }
    const json = (await res.json()) as { pairs?: DexPair[] };
    const best = new Map<string, { chain: ChainId; liq: number }>();
    for (const pair of json.pairs || []) {
      const addr = (pair.baseToken?.address || "").toLowerCase();
      const chain = resolveGmgnChain(pair.chainId);
      if (!addr || !chain) continue;
      const liq = pair.liquidity?.usd || 0;
      const prev = best.get(addr);
      if (!prev || liq > prev.liq) best.set(addr, { chain, liq });
    }
    for (const [addr, row] of best) out.set(addr, row.chain);
  } catch (err) {
    logEvent({
      level: "warn",
      event: "gmgn_chain",
      outcome: "error",
      source: "dex",
      url,
      detail: err instanceof Error ? err.message : "ağ tespiti",
    });
  }
  return out;
}
