import { KNOWN_WALLETS, normalizeHandle } from "./known";
import { scoreGem, rankGems } from "./score";
import type { ChainId, FindResult, Gem, PulseStatus, TapeFill, Trader } from "./types";

const PULSE = "https://fomopulse.app";
const DEX = "https://api.dexscreener.com";
const FOMOAPI = "https://api.fomoapi.io";

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: "application/json", ...(init?.headers || {}) },
      next: { revalidate: 20 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchPulseStatus(): Promise<PulseStatus | null> {
  const raw = await getJson<{
    chain_id: number; wallets: number; trades: number; lag_seconds: number;
    latency_ms: number; last_block: number; source: string;
    overview?: { fills: number; volume: number; tokens: number; biggest_buy?: { usd: number; symbol: string; handle: string } };
  }>(`${PULSE}/api/status`);
  if (!raw) return null;
  return {
    chainId: raw.chain_id, wallets: raw.wallets, trades: raw.trades,
    lagSeconds: raw.lag_seconds, latencyMs: raw.latency_ms, lastBlock: raw.last_block,
    fills24h: raw.overview?.fills ?? 0, volume24h: raw.overview?.volume ?? 0, tokens24h: raw.overview?.tokens ?? 0,
    biggestBuy: raw.overview?.biggest_buy ? { usd: raw.overview.biggest_buy.usd, symbol: raw.overview.biggest_buy.symbol, handle: raw.overview.biggest_buy.handle } : null,
    source: raw.source,
  };
}

export async function fetchPulseTape(limit = 80): Promise<TapeFill[]> {
  const raw = await getJson<Array<Record<string, unknown>>>(`${PULSE}/api/tape?limit=${limit}&dust=0`);
  if (!raw) return [];
  const seen = new Set<string>();
  return raw.map((row) => {
    const token = String(row.token || "");
    const firstBuy = Boolean(row.new_position) && !seen.has(token);
    seen.add(`${token}:${String(row.wallet || "")}`);
    return {
      id: `rh-${row.id}`, ts: Number(row.ts), chain: "robinhood" as const,
      side: row.side === "sell" ? "sell" as const : "buy" as const,
      usd: Number(row.usd || 0), amount: Number(row.amount || 0), price: (row.price as number | null) ?? null,
      token, symbol: String(row.symbol || "???"), name: String(row.name || row.symbol || "token"),
      mcap: (row.market_cap as number | null) ?? null, liquidity: (row.liquidity as number | null) ?? null,
      change24: (row.change24 as number | null) ?? null, pairUrl: (row.pair_url as string | null) ?? null,
      imageUrl: (row.image_url as string | null) ?? null, wallet: (row.wallet as string | null) ?? null,
      handle: (row.handle as string | null) ?? null, followers: (row.followers as number | null) ?? null,
      profileUrl: (row.profile_url as string | null) ?? null, rank: (row.rank as number | null) ?? null,
      tx: (row.tx as string | null) ?? null, firstBuy, flags: (row.flags as string[]) || [], source: "fomopulse" as const,
    };
  });
}

export async function fetchPulseTraders(): Promise<Trader[]> {
  const raw = await getJson<Array<Record<string, unknown>>>(`${PULSE}/api/traders?limit=80`);
  if (!raw) return [];
  return raw.map((t) => {
    const handle = String(t.handle);
    return {
      handle, address: String(t.address || "") || null,
      solana: KNOWN_WALLETS[handle.toLowerCase()]?.solana ?? null,
      displayName: String(t.display_name || handle), avatarUrl: (t.avatar_url as string | null) ?? null,
      followers: Number(t.followers || 0), clan: (t.clan as string | null) ?? null,
      profileUrl: String(t.profile_url || `https://fomo.family/profile/${handle}`),
      fills: Number(t.fills || 0), volume: Number(t.tape_volume || 0),
      realized: Number(t.realized || 0), unrealized: Number(t.unrealized || 0),
      wins: Number(t.wins || 0), trips: Number(t.trips || 0), openTokens: Number(t.open_tokens || 0),
      rank: (t.rank as number | null) ?? null, lastTs: (t.last_ts as number | null) ?? null,
    };
  });
}

export async function fetchPulseGems(): Promise<Gem[]> {
  const raw = await getJson<Array<Record<string, unknown>>>(`${PULSE}/api/discover?limit=60`);
  if (!raw) return [];
  return raw.map((d) => {
    const scored = scoreGem({
      mcap: (d.market_cap as number | null) ?? null, liquidity: (d.liquidity as number | null) ?? null,
      change24: (d.change24 as number | null) ?? null, volume24: (d.volume24 as number | null) ?? null,
      buyers: Number(d.buyers || 0), boughtUsd: Number(d.bought_usd || 0), soldUsd: Number(d.sold_usd || 0),
      pairCreatedAt: (d.pair_created_at as number | null) ?? null, firstBuyer: (d.first_buyer as string | null) ?? null,
    });
    const token = String(d.token);
    const pair = d.pair_address ? `https://dexscreener.com/robinhood/${d.pair_address}` : `https://dexscreener.com/robinhood/${token}`;
    return {
      id: `rh-${token}`, chain: "robinhood" as const, token, symbol: String(d.symbol || "???"),
      name: String(d.name || d.symbol || "token"), imageUrl: (d.image_url as string | null) ?? null,
      price: (d.price as number | null) ?? null, mcap: (d.market_cap as number | null) ?? null,
      liquidity: (d.liquidity as number | null) ?? null, change24: (d.change24 as number | null) ?? null,
      volume24: (d.volume24 as number | null) ?? null, pairUrl: pair,
      pairCreatedAt: (d.pair_created_at as number | null) ?? null, buyers: Number(d.buyers || 0),
      firstBuyer: (d.first_buyer as string | null) ?? null, boughtUsd: Number(d.bought_usd || 0),
      soldUsd: Number(d.sold_usd || 0), score: scored.score, reasons: scored.reasons, source: "fomopulse discover",
    };
  });
}

type DexPair = {
  chainId: string; dexId: string; url: string; pairCreatedAt?: number; priceUsd?: string;
  marketCap?: number; fdv?: number; liquidity?: { usd?: number }; volume?: { h24?: number };
  priceChange?: { h24?: number }; txns?: { h24?: { buys?: number; sells?: number } };
  baseToken?: { address: string; name: string; symbol: string };
};

function chainFromDex(id: string): ChainId | null {
  if (id === "solana" || id === "base" || id === "bsc" || id === "ethereum" || id === "robinhood") return id;
  return null;
}

function gemFromPair(p: DexPair): Gem | null {
  const chain = chainFromDex(p.chainId);
  const token = p.baseToken?.address;
  if (!chain || !token || chain === "robinhood") return null;
  const mcap = p.marketCap ?? p.fdv ?? null;
  const liq = p.liquidity?.usd ?? null;
  const vol = p.volume?.h24 ?? null;
  const buyers = p.txns?.h24?.buys ?? 0;
  const scored = scoreGem({
    mcap, liquidity: liq, change24: p.priceChange?.h24 ?? null, volume24: vol,
    buyers: Math.min(buyers, 40), boughtUsd: vol ? vol * 0.55 : 0, soldUsd: vol ? vol * 0.45 : 0,
    pairCreatedAt: p.pairCreatedAt ?? null, firstBuyer: null,
  });
  return {
    id: `${chain}-${token}`, chain, token, symbol: p.baseToken?.symbol || "???",
    name: p.baseToken?.name || p.baseToken?.symbol || "token", imageUrl: null,
    price: p.priceUsd ? Number(p.priceUsd) : null, mcap, liquidity: liq,
    change24: p.priceChange?.h24 ?? null, volume24: vol, pairUrl: p.url,
    pairCreatedAt: p.pairCreatedAt ?? null, buyers, firstBuyer: null,
    boughtUsd: vol ? vol * 0.55 : 0, soldUsd: vol ? vol * 0.45 : 0,
    score: scored.score, reasons: [...scored.reasons, p.dexId], source: "dexscreener",
  };
}

export async function fetchSolanaGems(): Promise<Gem[]> {
  const bags = await Promise.all(["solana new", "pump.fun", "base meme"].map((q) =>
    getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/search?q=${encodeURIComponent(q)}`),
  ));
  const seen = new Set<string>();
  const gems: Gem[] = [];
  for (const bag of bags) {
    for (const p of bag?.pairs || []) {
      const g = gemFromPair(p);
      if (!g || seen.has(g.id) || (g.mcap ?? 0) > 80_000_000) continue;
      seen.add(g.id);
      gems.push(g);
    }
  }
  return rankGems(gems).slice(0, 40);
}

export async function fetchAllGems(): Promise<Gem[]> {
  const [rh, sol] = await Promise.all([fetchPulseGems(), fetchSolanaGems()]);
  return rankGems([...rh, ...sol]);
}

export async function fetchMixedTape(): Promise<TapeFill[]> {
  const [pulse, gems] = await Promise.all([fetchPulseTape(70), fetchSolanaGems()]);
  const solTape: TapeFill[] = gems.filter((g) => g.chain === "solana" && g.volume24 && g.volume24 > 5000).slice(0, 18).map((g, i) => ({
    id: `sol-${g.token}-${i}`, ts: Math.floor((g.pairCreatedAt || Date.now()) / 1000), chain: "solana",
    side: "buy", usd: Math.min(g.boughtUsd || 0, 12000) / Math.max(3, Math.min(g.buyers, 12)), amount: 0,
    price: g.price, token: g.token, symbol: g.symbol, name: g.name, mcap: g.mcap, liquidity: g.liquidity,
    change24: g.change24, pairUrl: g.pairUrl, imageUrl: g.imageUrl, wallet: null, handle: null,
    followers: null, profileUrl: null, rank: null, tx: null,
    firstBuy: Boolean(g.pairCreatedAt && Date.now() - g.pairCreatedAt < 3 * 3600_000),
    flags: ["dex-flow"], source: "dexscreener",
  }));
  return [...pulse, ...solTape].sort((a, b) => b.ts - a.ts);
}

export async function findTrader(raw: string): Promise<FindResult> {
  const query = raw.trim();
  const handle = normalizeHandle(query);
  const known = KNOWN_WALLETS[handle];
  const traders = await fetchPulseTraders();
  const live = traders.find((t) => t.handle.toLowerCase() === handle);
  const key = process.env.FOMOAPI_KEY;
  let apiEvm: string | null = null;
  let apiSol: string | null = null;
  if (key && handle) {
    const api = await getJson<{ wallets?: { evm?: string; solana?: string } }>(`${FOMOAPI}/v2/users/${handle}`, {
      headers: { authorization: `Bearer ${key}` },
    });
    apiEvm = api?.wallets?.evm ?? null;
    apiSol = api?.wallets?.solana ?? null;
  }
  const evm = apiEvm || live?.address || known?.evm || null;
  const solana = apiSol || live?.solana || known?.solana || null;
  let proven: FindResult["proven"] = "unproven";
  let note = "Tek kaynak yetmez. Profil adresi trading cuzdani degildir.";
  if (apiEvm || apiSol) { proven = "verified"; note = "fomoapi.io resolve + canli tape."; }
  else if (live && known) { proven = "verified"; note = "fomopulse tape + arastirma mapping."; }
  else if (live) { proven = "mapped"; note = "fomopulse evreninde var. SOL ayrica teyit edilmeli."; }
  else if (known) { proven = "mapped"; note = known.note; }
  return {
    query, handle: handle || null, displayName: live?.displayName || handle || null,
    profileUrl: live?.profileUrl || (handle ? `https://fomo.family/profile/${handle}` : null),
    followers: live?.followers ?? null, evm, solana, proven, note, trader: live || null,
  };
}
