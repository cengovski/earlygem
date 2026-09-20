import { getJson } from "./http";
import { logEvent } from "./log";
import { rankGems, scoreGem } from "./score";
import type { ChainId, Gem } from "./types";

const DEX = "https://api.dexscreener.com";

const JUNK = new Set([
  "sol",
  "wsol",
  "usdc",
  "usdt",
  "eth",
  "weth",
  "bnb",
  "wbnb",
  "btc",
  "wbtc",
  "pump",
  "pumpfun",
  "pairbase",
  "test",
  "testing",
  "sample",
]);

type DexPair = {
  chainId: string;
  dexId: string;
  url: string;
  pairCreatedAt?: number;
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  volume?: { h24?: number };
  priceChange?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } };
  baseToken?: { address: string; name: string; symbol: string };
  info?: { imageUrl?: string };
};

function chainFromDex(id: string): ChainId | null {
  if (id === "solana") return "solana";
  if (id === "base") return "base";
  return null;
}

function isJunk(p: DexPair): boolean {
  const symbol = (p.baseToken?.symbol || "").trim();
  const name = (p.baseToken?.name || "").trim();
  const sym = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!symbol || JUNK.has(sym)) return true;
  if (/pairbase|testdog|sampletoken/i.test(sym + name)) return true;
  if (symbol.length > 18) return true;
  const mcap = p.marketCap ?? p.fdv ?? 0;
  const liq = p.liquidity?.usd ?? 0;
  const vol = p.volume?.h24 ?? 0;
  const created = p.pairCreatedAt ?? 0;
  const ageMs = created ? Date.now() - (created < 10_000_000_000 ? created * 1000 : created) : null;
  const pumpish = p.dexId === "pumpfun" || p.dexId === "pumpswap" || p.dexId === "moonshot";
  if (pumpish && mcap >= 4000 && mcap <= 4_000_000 && (ageMs == null || ageMs < 3 * 24 * 3600_000)) return false;
  if (mcap < 4000 && liq < 4000) return true;
  if (mcap > 12_000_000) return true;
  if (liq < 2500 && !pumpish) return true;
  if (vol < 1500 && ageMs != null && ageMs > 36 * 3600_000) return true;
  return false;
}

function gemFromPair(p: DexPair): Gem | null {
  const chain = chainFromDex(p.chainId);
  const token = p.baseToken?.address;
  if (!chain || !token || isJunk(p)) return null;
  const mcap = p.marketCap ?? p.fdv ?? null;
  const liq = p.liquidity?.usd ?? null;
  const change = p.priceChange?.h24 ?? null;
  const vol = p.volume?.h24 ?? null;
  const buyers = p.txns?.h24?.buys ?? 0;
  const scored = scoreGem({
    mcap,
    liquidity: liq,
    change24: change,
    volume24: vol,
    buyers: Math.min(buyers, 20),
    boughtUsd: vol ? vol * 0.55 : 0,
    soldUsd: vol ? vol * 0.45 : 0,
    pairCreatedAt: p.pairCreatedAt ?? null,
    firstBuyer: null,
    smartBuyers: [],
    dexOnly: true,
  });
  return {
    id: `${chain}-${token}`,
    chain,
    token,
    symbol: p.baseToken?.symbol || "???",
    name: p.baseToken?.name || p.baseToken?.symbol || "token",
    imageUrl: p.info?.imageUrl || null,
    price: p.priceUsd ? Number(p.priceUsd) : null,
    mcap,
    liquidity: liq,
    change24: change,
    volume24: vol,
    pairUrl: p.url,
    pairCreatedAt: p.pairCreatedAt ?? null,
    buyers,
    firstBuyer: null,
    boughtUsd: vol ? vol * 0.55 : 0,
    soldUsd: vol ? vol * 0.45 : 0,
    score: scored.score,
    reasons: scored.reasons,
    source: `dex ${p.dexId || "watch"}`,
    smartBuyers: [],
    kolCount: 0,
    smartCount: 0,
    lastSmartTs: null,
    bestRank: null,
    isStock: false,
  };
}

export async function fetchSolWatch(): Promise<Gem[]> {
  const [pump, aero, boosts] = await Promise.all([
    getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/search?q=${encodeURIComponent("pumpfun")}`),
    getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/search?q=${encodeURIComponent("aerodrome")}`),
    getJson<Array<{ chainId: string; tokenAddress: string }>>(`${DEX}/token-boosts/top/v1`),
  ]);
  const want = new Map<string, Set<string>>();
  for (const row of boosts || []) {
    if (row?.chainId !== "solana" && row?.chainId !== "base") continue;
    if (!row.tokenAddress) continue;
    if (!want.has(row.chainId)) want.set(row.chainId, new Set());
    want.get(row.chainId)!.add(row.tokenAddress);
  }
  const resolved = await Promise.all(
    [...want.entries()].map(([chain, addrs]) =>
      getJson<DexPair[]>(`${DEX}/tokens/v1/${chain}/${[...addrs].slice(0, 12).join(",")}`),
    ),
  );
  const seen = new Set<string>();
  const gems: Gem[] = [];
  const bags = [...(pump?.pairs || []), ...(aero?.pairs || []), ...resolved.flatMap((b) => b || [])];
  for (const p of bags) {
    const g = gemFromPair(p);
    if (!g || seen.has(g.id)) continue;
    seen.add(g.id);
    gems.push(g);
  }
  const ranked = rankGems(gems).slice(0, 16);
  logEvent({
    level: ranked.length ? "info" : "warn",
    event: "dex_watch",
    outcome: ranked.length ? "ok" : "empty",
    count: ranked.length,
    detail: `raw=${bags.length}`,
  });
  return ranked;
}
