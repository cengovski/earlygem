import { scoreGem } from "./score";
import { isWatchedKind } from "./smart";
import type { Gem, GemBuyer, SmartKind, TapeFill, Trader } from "./types";

const RPCS = ["https://solana-rpc.publicnode.com", "https://api.mainnet-beta.solana.com"];
const DEX = "https://api.dexscreener.com";
const STABLE = new Set([
  "so11111111111111111111111111111111111111112",
  "epjfwdd5aufqssqem2qn1xzybapc8g4weggkzwytdt1v",
  "es9vmfrzacermjfrf4h2fyd4kconky11mcce8benwnyb",
  "usd1ttk6fltkrcz2x3leqiil5t5sqfks2ntrdkeqmgd",
]);

type RpcSig = { signature: string; blockTime?: number | null; err: unknown };
type TokBal = { mint: string; owner?: string; uiTokenAmount?: { uiAmount?: number | null } };
type RpcTx = {
  blockTime?: number | null;
  meta?: { err: unknown; preTokenBalances?: TokBal[]; postTokenBalances?: TokBal[] };
};
type DexPair = {
  url?: string;
  priceUsd?: string;
  marketCap?: number;
  fdv?: number;
  liquidity?: { usd?: number };
  priceChange?: { h24?: number };
  baseToken?: { address: string; name: string; symbol: string };
};

async function rpc<T>(method: string, params: unknown[]): Promise<T | null> {
  const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
  for (const url of RPCS) {
    try {
      const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, cache: "no-store" });
      if (!res.ok) continue;
      const json = (await res.json()) as { result?: T };
      if (json.result != null) return json.result;
    } catch {
      continue;
    }
  }
  return null;
}

function ownerDeltas(tx: RpcTx, owner: string) {
  const pre = new Map<string, number>();
  const post = new Map<string, number>();
  for (const row of tx.meta?.preTokenBalances || []) {
    if (row.owner !== owner || !row.mint) continue;
    pre.set(row.mint, row.uiTokenAmount?.uiAmount || 0);
  }
  for (const row of tx.meta?.postTokenBalances || []) {
    if (row.owner !== owner || !row.mint) continue;
    post.set(row.mint, row.uiTokenAmount?.uiAmount || 0);
  }
  const out: { mint: string; delta: number }[] = [];
  for (const mint of new Set([...pre.keys(), ...post.keys()])) {
    if (STABLE.has(mint.toLowerCase())) continue;
    out.push({ mint, delta: (post.get(mint) || 0) - (pre.get(mint) || 0) });
  }
  return out.filter((r) => Math.abs(r.delta) > 0);
}

export async function fetchSolTape(traders: Trader[]): Promise<TapeFill[]> {
  const roster = traders.filter((t) => t.solana).slice(0, 8);
  if (!roster.length) return [];
  const bags = await Promise.all(
    roster.map(async (trader) => {
      const addr = trader.solana!;
      const sigs = (await rpc<RpcSig[]>("getSignaturesForAddress", [addr, { limit: 8 }])) || [];
      const ok = sigs.filter((s) => !s.err).slice(0, 3);
      const rows: TapeFill[] = [];
      for (const sig of ok) {
        const tx = await rpc<RpcTx>("getTransaction", [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
        if (!tx || tx.meta?.err) continue;
        const deltas = ownerDeltas(tx, addr);
        if (!deltas.length) continue;
        const best = deltas.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
        rows.push({
          id: `sol-${sig.signature.slice(0, 16)}`,
          ts: (tx.blockTime || sig.blockTime || 0) * 1000,
          chain: "solana",
          side: best.delta > 0 ? "buy" : "sell",
          usd: 0,
          amount: Math.abs(best.delta),
          price: null,
          token: best.mint,
          symbol: best.mint.slice(0, 4),
          name: best.mint.slice(0, 6),
          mcap: null,
          liquidity: null,
          change24: null,
          pairUrl: `https://dexscreener.com/solana/${best.mint}`,
          imageUrl: null,
          wallet: addr,
          handle: trader.handle,
          followers: trader.followers,
          profileUrl: trader.profileUrl,
          rank: trader.rank,
          tx: sig.signature,
          firstBuy: false,
          flags: [trader.kind],
          source: "dexscreener",
          smartKind: trader.kind,
        });
      }
      return rows;
    }),
  );
  const fills = bags.flat();
  const mints = [...new Set(fills.map((f) => f.token))].slice(0, 20);
  if (mints.length) {
    try {
      const res = await fetch(`${DEX}/tokens/v1/solana/${mints.join(",")}`, { cache: "no-store" });
      const pairs = res.ok ? ((await res.json()) as DexPair[]) : [];
      const byMint = new Map<string, DexPair>();
      for (const p of pairs || []) {
        const mint = p.baseToken?.address;
        if (mint && !byMint.has(mint)) byMint.set(mint, p);
      }
      for (const fill of fills) {
        const p = byMint.get(fill.token);
        if (!p) continue;
        fill.symbol = p.baseToken?.symbol || fill.symbol;
        fill.name = p.baseToken?.name || fill.name;
        fill.price = p.priceUsd ? Number(p.priceUsd) : null;
        fill.mcap = p.marketCap ?? p.fdv ?? null;
        fill.liquidity = p.liquidity?.usd ?? null;
        fill.change24 = p.priceChange?.h24 ?? null;
        fill.pairUrl = p.url || fill.pairUrl;
        fill.usd = fill.price ? fill.amount * fill.price : 0;
      }
    } catch {
      /* keep raw fills */
    }
  }
  return fills.filter((f) => f.usd >= 8 || f.amount > 0).sort((a, b) => b.ts - a.ts);
}

export function gemsFromSolTape(tape: TapeFill[]): Gem[] {
  const byToken = new Map<string, Gem>();
  for (const fill of tape.filter((t) => t.side === "buy" && t.handle && isWatchedKind(t.smartKind))) {
    const key = fill.token.toLowerCase();
    let gem = byToken.get(key);
    if (!gem) {
      gem = {
        id: `sol-${fill.token}`,
        chain: "solana",
        token: fill.token,
        symbol: fill.symbol,
        name: fill.name,
        imageUrl: fill.imageUrl,
        price: fill.price,
        mcap: fill.mcap,
        liquidity: fill.liquidity,
        change24: fill.change24,
        volume24: null,
        pairUrl: fill.pairUrl,
        pairCreatedAt: null,
        buyers: 0,
        firstBuyer: fill.handle,
        boughtUsd: 0,
        soldUsd: 0,
        score: 0,
        reasons: [],
        source: "FOMO SOL tape",
        smartBuyers: [],
        kolCount: 0,
        smartCount: 0,
        lastSmartTs: null,
        bestRank: null,
        isStock: false,
      };
      byToken.set(key, gem);
    }
    gem.boughtUsd += fill.usd;
    gem.buyers += 1;
    if (fill.handle && !gem.smartBuyers.some((b) => b.handle.toLowerCase() === fill.handle!.toLowerCase())) {
      gem.smartBuyers.push({
        handle: fill.handle,
        usd: fill.usd,
        ts: fill.ts,
        rank: fill.rank,
        followers: fill.followers || 0,
        kind: (fill.smartKind || "active") as SmartKind,
        avatarUrl: null,
      } satisfies GemBuyer);
    }
  }
  const out: Gem[] = [];
  for (const gem of byToken.values()) {
    const watched = gem.smartBuyers.filter((b) => isWatchedKind(b.kind));
    gem.kolCount = gem.smartBuyers.filter((b) => b.kind === "kol").length;
    gem.smartCount = gem.smartBuyers.filter((b) => b.kind === "smart").length;
    gem.lastSmartTs = watched.length ? Math.max(...watched.map((b) => b.ts)) : null;
    gem.bestRank = watched.length ? Math.min(...watched.map((b) => b.rank || 999)) : null;
    const scored = scoreGem({
      mcap: gem.mcap,
      liquidity: gem.liquidity,
      change24: gem.change24,
      volume24: gem.volume24,
      buyers: gem.buyers,
      boughtUsd: gem.boughtUsd,
      soldUsd: gem.soldUsd,
      pairCreatedAt: gem.pairCreatedAt,
      firstBuyer: gem.firstBuyer,
      smartBuyers: gem.smartBuyers,
      lastSmartTs: gem.lastSmartTs,
      bestRank: gem.bestRank,
    });
    gem.score = scored.score;
    gem.reasons = scored.reasons;
    out.push(gem);
  }
  return out;
}
