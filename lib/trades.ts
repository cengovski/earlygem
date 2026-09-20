import { scoreGem } from "./score";
import { isWatchedKind } from "./smart";
import type { Gem, GemBuyer, TapeFill } from "./types";

export const MIN_TRADE_USD = 8;

export function isSwapFill(row: {
  side?: string | null;
  usd?: number | null;
  flags?: string[] | null;
  source?: string | null;
}): boolean {
  if (row.side !== "buy" && row.side !== "sell") return false;
  if ((row.usd || 0) < MIN_TRADE_USD) return false;
  const flags = (row.flags || []).map((f) => f.toLowerCase());
  if (flags.some((f) => f.includes("transfer") || f.includes("airdrop") || f.includes("gift") || f.includes("inflow"))) {
    return false;
  }
  return true;
}

function key(handle: string, token: string) {
  return `${handle.toLowerCase()}::${token.toLowerCase()}`;
}

export function swapIndex(tape: TapeFill[]) {
  const buys = new Set<string>();
  const sells = new Set<string>();
  const buyUsd = new Map<string, number>();
  const lastBuyTs = new Map<string, number>();
  for (const row of tape) {
    if (!row.handle || !isSwapFill(row)) continue;
    const k = key(row.handle, row.token);
    if (row.side === "buy") {
      buys.add(k);
      buyUsd.set(k, (buyUsd.get(k) || 0) + (row.usd || 0));
      lastBuyTs.set(k, Math.max(lastBuyTs.get(k) || 0, row.ts || 0));
    } else {
      sells.add(k);
    }
  }
  return { buys, sells, buyUsd, lastBuyTs };
}

function rescore(gem: Gem): Gem {
  const watched = gem.smartBuyers.filter((b) => isWatchedKind(b.kind));
  gem.kolCount = gem.smartBuyers.filter((b) => b.kind === "kol").length;
  gem.smartCount = gem.smartBuyers.filter((b) => b.kind === "smart").length;
  gem.bestRank = watched.length ? Math.min(...watched.map((b) => b.rank || 999)) : null;
  gem.lastSmartTs = watched.length ? Math.max(...watched.map((b) => b.ts)) : null;
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
    isStock: gem.isStock,
  });
  gem.score = scored.score;
  gem.reasons = scored.reasons;
  return gem;
}

export function gemsFromSwaps(discover: Gem[], tape: TapeFill[]): Gem[] {
  const idx = swapIndex(tape);
  const byToken = new Map<string, Gem>();

  for (const gem of discover) {
    const confirmed: GemBuyer[] = [];
    for (const b of gem.smartBuyers) {
      const k = key(b.handle, gem.token);
      if (!idx.buys.has(k)) continue;
      confirmed.push({
        ...b,
        usd: Math.max(b.usd || 0, idx.buyUsd.get(k) || 0),
        ts: Math.max(b.ts || 0, idx.lastBuyTs.get(k) || 0),
      });
    }
    if (!confirmed.length) continue;
    byToken.set(gem.token.toLowerCase(), rescore({ ...gem, smartBuyers: confirmed, source: "fomopulse tape buy" }));
  }

  const grouped = new Map<string, TapeFill[]>();
  for (const row of tape) {
    if (row.side !== "buy" || !row.handle || !isSwapFill(row) || !isWatchedKind(row.smartKind)) continue;
    const k = row.token.toLowerCase();
    const bag = grouped.get(k) || [];
    bag.push(row);
    grouped.set(k, bag);
  }

  for (const [token, rows] of grouped) {
    let gem = byToken.get(token);
    if (!gem) {
      const head = rows[0];
      gem = {
        id: `rh-${head.token}`,
        chain: "robinhood",
        token: head.token,
        symbol: head.symbol,
        name: head.name,
        imageUrl: head.imageUrl,
        price: head.price,
        mcap: head.mcap,
        liquidity: head.liquidity,
        change24: head.change24,
        volume24: null,
        pairUrl: head.pairUrl,
        pairCreatedAt: null,
        buyers: 0,
        firstBuyer: head.handle,
        boughtUsd: 0,
        soldUsd: 0,
        score: 0,
        reasons: [],
        source: "smart tape buy",
        smartBuyers: [],
        kolCount: 0,
        smartCount: 0,
        lastSmartTs: null,
        bestRank: null,
        isStock: head.flags.includes("stock"),
      };
    }
    for (const fill of rows) {
      gem.boughtUsd += fill.usd;
      gem.buyers += 1;
      if (fill.handle && !gem.smartBuyers.some((b) => b.handle.toLowerCase() === fill.handle!.toLowerCase())) {
        gem.smartBuyers.push({
          handle: fill.handle,
          usd: fill.usd,
          ts: fill.ts,
          rank: fill.rank,
          followers: fill.followers || 0,
          kind: fill.smartKind || "active",
          avatarUrl: null,
        });
      }
    }
    byToken.set(token, rescore(gem));
  }

  return [...byToken.values()].filter((g) => !g.isStock && g.kolCount + g.smartCount > 0);
}
