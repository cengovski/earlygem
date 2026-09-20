import { KNOWN_WALLETS, normalizeHandle } from "./known";
import { logEvent } from "./log";
import { getJson, getPulse, PULSE } from "./pulse";
import { featuredGems, rankGems, scoreGem } from "./score";
import { classifyTrader, isWatchedKind, traderIndex } from "./smart";
import type { ChainId, FindResult, Gem, GemBuyer, PulseStatus, SmartKind, TapeFill, Trader } from "./types";

const DEX = "https://api.dexscreener.com";
const FOMOAPI = "https://api.fomoapi.io";
const JUNK_SYMBOL = new Set(["sol", "wsol", "usdc", "usdt", "eth", "weth", "bnb", "wbnb", "btc", "wbtc", "pump", "pumpfun"]);

type PulseFill = {
  id: number; ts: number; tx: string; side: string; usd: number; amount: number; price: number | null;
  wallet: string; handle: string | null; display_name: string | null; followers: number | null;
  profile_url: string | null; rank: number | null; token: string; symbol: string; name: string;
  liquidity: number | null; pair_url: string | null; pair_created_at: number | null; change24: number | null;
  market_cap: number | null; image_url: string | null; flags?: string[]; new_position?: number; is_stock?: number;
};
type PulseTrader = {
  handle: string; address: string; display_name: string; avatar_url: string | null; clan: string | null;
  followers: number; profile_url: string; fills: number; tape_volume: number; realized: number; unrealized: number;
  wins: number; trips: number; open_tokens: number; rank: number | null; last_ts: number | null;
};
type PulseBuyer = { handle: string; ts: number; usd: number; rank: number | null; avatar_url: string | null };
type PulseDiscover = {
  token: string; symbol: string; name: string; image_url: string | null; price: number | null; liquidity: number | null;
  change24: number | null; volume24: number | null; market_cap: number | null; pair_created_at: number | null;
  pair_address: string | null; buyers: number; first_buyer: string | null; bought_usd: number; sold_usd: number;
  buyers_list?: PulseBuyer[]; best_rank?: number | null; wash?: number; is_stock?: number; last_fill_ts?: number | null;
};
type PulseStatusRaw = {
  chain_id: number; wallets: number; trades: number; lag_seconds: number; latency_ms: number; last_block: number;
  source: string; overview?: { fills: number; volume: number; tokens: number; biggest_buy?: { usd: number; symbol: string; handle: string } };
};

function kindForHandle(handle: string | null, rank: number | null, followers: number | null, traders: Map<string, Trader>): SmartKind | null {
  if (!handle) return null;
  const live = traders.get(handle.toLowerCase());
  if (live) return live.kind;
  return classifyTrader({ followers: followers || 0, rank, volume: 0, realized: 0, unrealized: 0, wins: 0, trips: 0, fills: 0 }).kind;
}

function buyersFromList(list: PulseBuyer[] | undefined, traders: Map<string, Trader>): GemBuyer[] {
  const out: GemBuyer[] = [];
  const seen = new Set<string>();
  for (const b of list || []) {
    const key = (b.handle || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const live = traders.get(key);
    const kind = live?.kind ?? kindForHandle(b.handle, b.rank, live?.followers ?? 0, traders) ?? "active";
    out.push({ handle: b.handle, usd: b.usd || 0, ts: b.ts, rank: b.rank, followers: live?.followers ?? 0, kind, avatarUrl: b.avatar_url || live?.avatarUrl || null });
  }
  return out.sort((a, b) => ((b.kind === "kol" ? 3 : b.kind === "smart" ? 2 : 1) - (a.kind === "kol" ? 3 : a.kind === "smart" ? 2 : 1)) || (a.rank || 999) - (b.rank || 999));
}

function mapPulseTrader(t: PulseTrader): Trader {
  const tagged = classifyTrader({ handle: t.handle, followers: t.followers || 0, rank: t.rank, volume: t.tape_volume || 0, realized: t.realized || 0, unrealized: t.unrealized || 0, wins: t.wins || 0, trips: t.trips || 0, fills: t.fills || 0 });
  return {
    handle: t.handle, address: t.address, solana: KNOWN_WALLETS[t.handle.toLowerCase()]?.solana ?? null,
    displayName: t.display_name || t.handle, avatarUrl: t.avatar_url, followers: t.followers || 0, clan: t.clan,
    profileUrl: t.profile_url || `https://fomo.family/profile/${t.handle}`, fills: t.fills || 0, volume: t.tape_volume || 0,
    realized: t.realized || 0, unrealized: t.unrealized || 0, wins: t.wins || 0, trips: t.trips || 0,
    openTokens: t.open_tokens || 0, rank: t.rank, lastTs: t.last_ts, kind: tagged.kind, smartScore: tagged.smartScore, smartReasons: tagged.reasons,
  };
}

export async function fetchPulseStatus(): Promise<PulseStatus | null> {
  const raw = await getPulse<PulseStatusRaw>("/api/status");
  if (!raw) return null;
  return {
    chainId: raw.chain_id, wallets: raw.wallets, trades: raw.trades, lagSeconds: raw.lag_seconds,
    latencyMs: raw.latency_ms, lastBlock: raw.last_block, fills24h: raw.overview?.fills ?? 0,
    volume24h: raw.overview?.volume ?? 0, tokens24h: raw.overview?.tokens ?? 0,
    biggestBuy: raw.overview?.biggest_buy ? { usd: raw.overview.biggest_buy.usd, symbol: raw.overview.biggest_buy.symbol, handle: raw.overview.biggest_buy.handle } : null,
    source: raw.source,
  };
}

export async function fetchPulseTraders(): Promise<Trader[]> {
  const raw = await getPulse<PulseTrader[] | { traders?: PulseTrader[] }>("/api/traders?limit=100");
  const list = Array.isArray(raw) ? raw : raw?.traders || [];
  if (!list.length) {
    logEvent({ level: "warn", event: "traders", outcome: "empty", url: `${PULSE}/api/traders` });
    return [];
  }
  return list.filter((t) => t?.handle).map(mapPulseTrader);
}

function tradersFromTape(tape: TapeFill[]): Trader[] {
  const byHandle = new Map<string, TapeFill[]>();
  for (const row of tape) {
    if (!row.handle) continue;
    const key = row.handle.toLowerCase();
    const bag = byHandle.get(key) || [];
    bag.push(row);
    byHandle.set(key, bag);
  }
  return [...byHandle.values()].map((rows) => {
    const head = rows[0];
    return mapPulseTrader({
      handle: head.handle || "", address: head.wallet || "", display_name: head.handle || "", avatar_url: null, clan: null,
      followers: head.followers || 0, profile_url: head.profileUrl || "", fills: rows.length,
      tape_volume: rows.reduce((s, r) => s + (r.usd || 0), 0), realized: 0, unrealized: 0, wins: 0, trips: 0, open_tokens: 0,
      rank: head.rank, last_ts: Math.max(...rows.map((r) => r.ts)),
    });
  }).sort((a, b) => b.volume - a.volume);
}

function enrichFill(row: PulseFill, traders: Map<string, Trader>): TapeFill {
  const handle = row.handle;
  const kind = kindForHandle(handle, row.rank, row.followers, traders);
  return {
    id: `rh-${row.id}`, ts: row.ts, chain: "robinhood", side: row.side === "sell" ? "sell" : "buy",
    usd: row.usd ?? 0, amount: row.amount ?? 0, price: row.price, token: row.token, symbol: row.symbol || "???",
    name: row.name || row.symbol || "token", mcap: row.market_cap, liquidity: row.liquidity, change24: row.change24,
    pairUrl: row.pair_url, imageUrl: row.image_url, wallet: row.wallet, handle, followers: row.followers,
    profileUrl: row.profile_url || (handle ? `https://fomo.family/profile/${handle}` : null), rank: row.rank, tx: row.tx,
    firstBuy: Boolean(row.new_position), flags: [...(row.flags || []), ...(row.is_stock ? ["stock"] : []), ...(kind ? [kind] : [])],
    source: "fomopulse", smartKind: kind,
  };
}

export async function fetchPulseTape(limit = 120, traders?: Map<string, Trader>): Promise<TapeFill[]> {
  const raw = await getPulse<PulseFill[]>(`/api/tape?limit=${limit}&dust=0`);
  if (!raw) return [];
  const index = traders ?? traderIndex(await fetchPulseTraders());
  const seenToken = new Set<string>();
  return raw.map((row) => {
    const fill = enrichFill(row, index);
    const firstOnTape = fill.side === "buy" && Boolean(row.new_position) && !seenToken.has(row.token);
    if (fill.side === "buy") seenToken.add(row.token);
    return { ...fill, firstBuy: firstOnTape };
  });
}

function gemFromDiscover(d: PulseDiscover, traders: Map<string, Trader>): Gem {
  const smartBuyers = buyersFromList(d.buyers_list, traders);
  const watched = smartBuyers.filter((b) => isWatchedKind(b.kind));
  const lastSmartTs = watched.length ? Math.max(...watched.map((b) => b.ts)) : (d.last_fill_ts ?? null);
  const scored = scoreGem({
    mcap: d.market_cap, liquidity: d.liquidity, change24: d.change24, volume24: d.volume24,
    buyers: d.buyers || 0, boughtUsd: d.bought_usd || 0, soldUsd: d.sold_usd || 0, pairCreatedAt: d.pair_created_at,
    firstBuyer: d.first_buyer, smartBuyers, lastSmartTs, bestRank: d.best_rank ?? (watched[0]?.rank ?? null),
    isStock: Boolean(d.is_stock), wash: d.wash || 0,
  });
  return {
    id: `rh-${d.token}`, chain: "robinhood", token: d.token, symbol: d.symbol || "???", name: d.name || d.symbol || "token",
    imageUrl: d.image_url, price: d.price, mcap: d.market_cap, liquidity: d.liquidity, change24: d.change24, volume24: d.volume24,
    pairUrl: d.pair_address ? `https://dexscreener.com/robinhood/${d.pair_address}` : `https://dexscreener.com/robinhood/${d.token}`,
    pairCreatedAt: d.pair_created_at, buyers: d.buyers || 0, firstBuyer: d.first_buyer, boughtUsd: d.bought_usd || 0,
    soldUsd: d.sold_usd || 0, score: scored.score, reasons: scored.reasons, source: "fomopulse smart-cluster",
    smartBuyers, kolCount: smartBuyers.filter((b) => b.kind === "kol").length,
    smartCount: smartBuyers.filter((b) => b.kind === "smart").length, lastSmartTs,
    bestRank: d.best_rank ?? (watched[0]?.rank ?? null), isStock: Boolean(d.is_stock),
  };
}

export async function fetchPulseGems(traders?: Map<string, Trader>): Promise<Gem[]> {
  const raw = await getPulse<PulseDiscover[]>("/api/discover?limit=80");
  if (!raw) return [];
  const index = traders ?? traderIndex(await fetchPulseTraders());
  return raw.map((d) => gemFromDiscover(d, index));
}

type DexPair = {
  chainId: string; dexId: string; url: string; pairCreatedAt?: number; priceUsd?: string; marketCap?: number; fdv?: number;
  liquidity?: { usd?: number }; volume?: { h24?: number }; priceChange?: { h24?: number };
  txns?: { h24?: { buys?: number; sells?: number } }; baseToken?: { address: string; name: string; symbol: string };
};

function chainFromDex(id: string): ChainId | null {
  if (id === "solana" || id === "base" || id === "bsc" || id === "ethereum" || id === "robinhood") return id;
  return null;
}

function isJunkPair(p: DexPair): boolean {
  const symbol = (p.baseToken?.symbol || "").trim();
  const name = (p.baseToken?.name || "").trim();
  const sym = symbol.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!symbol || JUNK_SYMBOL.has(sym)) return true;
  if (/^(solana|pump\.?fun|we\s*pump|pumptv)$/i.test(symbol) || /^(solana|pump\.?fun|we\s*pump|pumptv)$/i.test(name)) return true;
  if ((p.marketCap ?? p.fdv ?? 0) < 1500 && (p.liquidity?.usd ?? 0) < 1500) return true;
  return false;
}

function gemFromPair(p: DexPair): Gem | null {
  const chain = chainFromDex(p.chainId);
  const token = p.baseToken?.address;
  if (!chain || !token || chain === "robinhood") return null;
  if (isJunkPair(p)) return null;
  if ((p.marketCap ?? p.fdv ?? 0) > 25_000_000) return null;
  const mcap = p.marketCap ?? p.fdv ?? null;
  const liq = p.liquidity?.usd ?? null;
  const vol = p.volume?.h24 ?? null;
  const buyers = p.txns?.h24?.buys ?? 0;
  const scored = scoreGem({
    mcap, liquidity: liq, change24: p.priceChange?.h24 ?? null, volume24: vol, buyers: Math.min(buyers, 20),
    boughtUsd: vol ? vol * 0.55 : 0, soldUsd: vol ? vol * 0.45 : 0, pairCreatedAt: p.pairCreatedAt ?? null,
    firstBuyer: null, smartBuyers: [], dexOnly: true,
  });
  return {
    id: `${chain}-${token}`, chain, token, symbol: p.baseToken?.symbol || "???", name: p.baseToken?.name || p.baseToken?.symbol || "token",
    imageUrl: null, price: p.priceUsd ? Number(p.priceUsd) : null, mcap, liquidity: liq, change24: p.priceChange?.h24 ?? null, volume24: vol,
    pairUrl: p.url, pairCreatedAt: p.pairCreatedAt ?? null, buyers, firstBuyer: null,
    boughtUsd: vol ? vol * 0.55 : 0, soldUsd: vol ? vol * 0.45 : 0, score: scored.score, reasons: scored.reasons,
    source: "dexscreener watch", smartBuyers: [], kolCount: 0, smartCount: 0, lastSmartTs: null, bestRank: null, isStock: false,
  };
}

export async function fetchSolanaGems(): Promise<Gem[]> {
  const [profiles, boosts, pump] = await Promise.all([
    getJson<Array<{ chainId: string; tokenAddress: string }>>(`${DEX}/token-profiles/latest/v1`),
    getJson<Array<{ chainId: string; tokenAddress: string }>>(`${DEX}/token-boosts/latest/v1`),
    getJson<{ pairs?: DexPair[] }>(`${DEX}/latest/dex/search?q=${encodeURIComponent("pumpfun")}`),
  ]);
  const byChain = new Map<string, Set<string>>();
  for (const row of [...(profiles || []), ...(boosts || [])]) {
    if (!row?.chainId || !row.tokenAddress) continue;
    if (row.chainId !== "solana" && row.chainId !== "base" && row.chainId !== "bsc") continue;
    if (!byChain.has(row.chainId)) byChain.set(row.chainId, new Set());
    byChain.get(row.chainId)!.add(row.tokenAddress);
  }
  const bags = await Promise.all([...byChain.entries()].map(([chain, addrs]) => getJson<DexPair[]>(`${DEX}/tokens/v1/${chain}/${[...addrs].slice(0, 18).join(",")}`)));
  const seen = new Set<string>();
  const gems: Gem[] = [];
  for (const bag of [...bags, pump?.pairs || []]) {
    for (const p of bag || []) {
      const g = gemFromPair(p);
      if (!g || seen.has(g.id)) continue;
      seen.add(g.id);
      gems.push(g);
    }
  }
  logEvent({ level: "info", event: "dex_watch", outcome: gems.length ? "ok" : "empty", count: gems.length });
  return rankGems(gems).slice(0, 24);
}

function mergeTapeIntoGems(gems: Gem[], tape: TapeFill[], traders: Map<string, Trader>): Gem[] {
  const byToken = new Map(gems.map((g) => [g.token.toLowerCase(), g]));
  for (const fill of tape.filter((t) => t.side === "buy" && t.chain === "robinhood" && t.handle)) {
    const key = fill.token.toLowerCase();
    let gem = byToken.get(key);
    if (!gem) {
      gem = {
        id: `rh-${fill.token}`, chain: "robinhood", token: fill.token, symbol: fill.symbol, name: fill.name,
        imageUrl: fill.imageUrl, price: fill.price, mcap: fill.mcap, liquidity: fill.liquidity, change24: fill.change24,
        volume24: null, pairUrl: fill.pairUrl, pairCreatedAt: null, buyers: 0, firstBuyer: fill.handle, boughtUsd: 0, soldUsd: 0,
        score: 0, reasons: [], source: "smart tape", smartBuyers: [], kolCount: 0, smartCount: 0, lastSmartTs: null, bestRank: null,
        isStock: fill.flags.includes("stock"),
      };
      byToken.set(key, gem);
    }
    gem.boughtUsd += fill.usd;
    gem.buyers += 1;
    if (fill.handle && !gem.smartBuyers.some((b) => b.handle.toLowerCase() === fill.handle!.toLowerCase())) {
      const live = traders.get(fill.handle.toLowerCase());
      gem.smartBuyers.push({ handle: fill.handle, usd: fill.usd, ts: fill.ts, rank: fill.rank, followers: fill.followers || live?.followers || 0, kind: fill.smartKind || live?.kind || "active", avatarUrl: live?.avatarUrl || null });
    }
    if (isWatchedKind(fill.smartKind) && (!gem.lastSmartTs || fill.ts > gem.lastSmartTs)) gem.lastSmartTs = fill.ts;
  }
  const out: Gem[] = [];
  for (const gem of byToken.values()) {
    const watched = gem.smartBuyers.filter((b) => isWatchedKind(b.kind));
    gem.kolCount = gem.smartBuyers.filter((b) => b.kind === "kol").length;
    gem.smartCount = gem.smartBuyers.filter((b) => b.kind === "smart").length;
    gem.bestRank = watched.length ? Math.min(...watched.map((b) => b.rank || 999)) : gem.bestRank;
    const scored = scoreGem({ mcap: gem.mcap, liquidity: gem.liquidity, change24: gem.change24, volume24: gem.volume24, buyers: gem.buyers, boughtUsd: gem.boughtUsd, soldUsd: gem.soldUsd, pairCreatedAt: gem.pairCreatedAt, firstBuyer: gem.firstBuyer, smartBuyers: gem.smartBuyers, lastSmartTs: gem.lastSmartTs, bestRank: gem.bestRank, isStock: gem.isStock });
    gem.score = scored.score;
    gem.reasons = scored.reasons;
    out.push(gem);
  }
  return out;
}

export async function fetchRadarBundle(): Promise<{ traders: Trader[]; tape: TapeFill[]; gems: Gem[]; featured: Gem[]; smartTape: TapeFill[]; dexWatch: Gem[] }> {
  let traders = await fetchPulseTraders();
  const [discover, tape, dexWatch] = await Promise.all([fetchPulseGems(traderIndex(traders)), fetchPulseTape(180, traderIndex(traders)), fetchSolanaGems()]);
  if (!traders.length) {
    traders = tradersFromTape(tape);
    logEvent({ level: "warn", event: "traders_fallback", outcome: traders.length ? "ok" : "empty", count: traders.length, detail: "derived_from_tape" });
  }
  const index = traderIndex(traders);
  const gems = rankGems(mergeTapeIntoGems(discover, tape, index).filter((g) => !g.isStock));
  return { traders, tape, gems, featured: featuredGems(gems, 6), smartTape: tape.filter((r) => isWatchedKind(r.smartKind)).slice(0, 40), dexWatch };
}

export async function fetchAllGems(): Promise<Gem[]> {
  const { gems, dexWatch } = await fetchRadarBundle();
  return rankGems([...gems, ...dexWatch]);
}

export async function fetchMixedTape(): Promise<TapeFill[]> {
  const { tape } = await fetchRadarBundle();
  return tape;
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
    const api = await getJson<{ wallets?: { evm?: string; solana?: string } }>(`${FOMOAPI}/v2/users/${handle}`, { headers: { authorization: `Bearer ${key}` } });
    apiEvm = api?.wallets?.evm ?? null;
    apiSol = api?.wallets?.solana ?? null;
  }
  const evm = apiEvm || live?.address || known?.evm || null;
  const solana = apiSol || live?.solana || known?.solana || null;
  let proven: FindResult["proven"] = "unproven";
  let note = "Tek kaynak yetmez. Profil adresi trading cüzdanı değildir.";
  if (apiEvm || apiSol) { proven = "verified"; note = "fomoapi.io resolve + canlı tape kesişimi."; }
  else if (live && known) { proven = "verified"; note = "fomopulse tape adresi, araştırma mapping'i ile örtüşüyor."; }
  else if (live) { proven = "mapped"; note = `Tape cüzdanı izleniyor · ${live.kind} · skor ${live.smartScore}.`; }
  else if (known) { proven = "mapped"; note = known.note; }
  return {
    query, handle: handle || null, displayName: live?.displayName || handle || null,
    profileUrl: live?.profileUrl || (handle ? `https://fomo.family/profile/${handle}` : null),
    followers: live?.followers ?? null, evm, solana, proven, note, trader: live || null,
  };
}
