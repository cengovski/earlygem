import { isScamGem, scamReasons } from "./scam";
import type { Gem, GemBuyer } from "./types";

const HOUR = 60 * 60 * 1000;

function createdMs(pairCreatedAt: number | null): number | null {
  if (!pairCreatedAt) return null;
  return pairCreatedAt < 10_000_000_000 ? pairCreatedAt * 1000 : pairCreatedAt;
}

export function scoreGem(input: {
  mcap: number | null;
  liquidity: number | null;
  change24: number | null;
  volume24: number | null;
  buyers: number;
  boughtUsd: number;
  soldUsd: number;
  pairCreatedAt: number | null;
  firstBuyer: string | null;
  smartBuyers?: GemBuyer[];
  lastSmartTs?: number | null;
  bestRank?: number | null;
  isStock?: boolean;
  wash?: number;
  dexOnly?: boolean;
  token?: string;
  symbol?: string;
  name?: string;
  pairUrl?: string | null;
  kolCount?: number;
  honeypot?: boolean | null;
}): { score: number; reasons: string[] } {
  if (input.honeypot) return { score: 0, reasons: ["honeypot"] };
  const flags = scamReasons({
    token: input.token || "",
    symbol: input.symbol || "",
    name: input.name || "",
    pairUrl: input.pairUrl || null,
    mcap: input.mcap,
    liquidity: input.liquidity,
    change24: input.change24,
    boughtUsd: input.boughtUsd,
    soldUsd: input.soldUsd,
    buyers: input.buyers,
    kolCount: input.kolCount ?? (input.smartBuyers || []).filter((b) => b.kind === "kol").length,
  });
  if (flags.length) return { score: 0, reasons: flags.slice(0, 4) };

  const reasons: string[] = [];
  let score = 8;
  const smart = input.smartBuyers || [];
  const kols = smart.filter((b) => b.kind === "kol");
  const smarts = smart.filter((b) => b.kind === "smart");
  const watched = smart.filter((b) => b.kind === "kol" || b.kind === "smart");

  if (kols.length) {
    score += Math.min(42, kols.length * 14);
    reasons.push(`${kols.length} KOL alım`);
  }
  if (smarts.length) {
    score += Math.min(28, smarts.length * 8);
    reasons.push(`${smarts.length} smart alım`);
  }
  if (watched.length >= 5) {
    score += 10;
    reasons.push("küme alımı");
  } else if (watched.length >= 3) {
    score += 5;
  }

  const best = input.bestRank ?? (watched.length ? Math.min(...watched.map((b) => b.rank || 999)) : null);
  if (best != null && best <= 10) {
    score += 12;
    reasons.push(`rank #${best} aldı`);
  } else if (best != null && best <= 25) {
    score += 6;
    reasons.push("top 25 aldı");
  }

  if (watched[0]) reasons.push(watched.slice(0, 3).map((b) => `@${b.handle}`).join(" "));

  const lastSmart = input.lastSmartTs
    ? input.lastSmartTs < 10_000_000_000
      ? input.lastSmartTs * 1000
      : input.lastSmartTs
    : null;
  if (lastSmart) {
    const age = Date.now() - lastSmart;
    if (age < 2 * HOUR) {
      score += 16;
      reasons.push("smart alış < 2sa");
    } else if (age < 12 * HOUR) {
      score += 10;
      reasons.push("smart alış < 12sa");
    } else if (age < 36 * HOUR) {
      score += 4;
    }
  }

  const created = createdMs(input.pairCreatedAt);
  const ageMs = created ? Date.now() - created : null;
  if (ageMs != null && ageMs < 6 * HOUR) {
    score += 12;
    reasons.push("havuz taze");
  } else if (ageMs != null && ageMs < 36 * HOUR) {
    score += 6;
    reasons.push("havuz < 36sa");
  } else if (ageMs != null && ageMs > 14 * 24 * HOUR && watched.length < 2) {
    score -= 18;
    reasons.push("eski havuz");
  }

  const mcap = input.mcap;
  if (mcap != null && mcap > 0 && mcap < 150_000) {
    score += 10;
    reasons.push("mikro cap");
  } else if (mcap != null && mcap < 1_200_000) {
    score += 7;
    reasons.push("low cap");
  } else if (mcap != null && mcap < 8_000_000) {
    score += 2;
  } else if (mcap != null && mcap > 40_000_000 && watched.length < 3) {
    score -= 22;
    reasons.push("erken değil / büyük cap");
  }

  if (input.buyers >= 12 && watched.length) score += 6;

  const sold = input.soldUsd || 0;
  const bought = input.boughtUsd || 0;
  if (bought > 0 && sold / bought < 0.12) {
    score += 8;
    reasons.push("satış zayıf");
  } else if (bought > 0 && sold / bought > 0.7) {
    score -= 10;
    reasons.push("dağıtıyorlar");
  }

  if (input.liquidity != null && input.liquidity >= 15_000 && input.liquidity < 600_000) score += 5;
  if (input.liquidity != null && input.liquidity < 2500) {
    score -= 22;
    reasons.push("ölü havuz");
  }
  if (input.isStock) {
    score -= 45;
    reasons.push("hisse / stock");
  }
  if ((input.wash || 0) > 0) {
    score -= 16;
    reasons.push("wash şüphesi");
  }
  if (input.dexOnly && watched.length === 0) {
    score = Math.min(score, 38);
    reasons.push("FOMO cüzdanı yok");
  }

  return { score: Math.max(0, Math.min(99, Math.round(score))), reasons: [...new Set(reasons)].slice(0, 5) };
}

export function rankGems(gems: Gem[]): Gem[] {
  return [...gems].sort((a, b) => {
    const aw = a.kolCount * 2 + a.smartCount;
    const bw = b.kolCount * 2 + b.smartCount;
    return b.score - a.score || bw - aw || (b.lastSmartTs || 0) - (a.lastSmartTs || 0);
  });
}

export function featuredGems(gems: Gem[], n = 6): Gem[] {
  const watched = gems.filter(
    (g) =>
      !g.isStock &&
      !isScamGem(g) &&
      !g.honeypot &&
      g.securityOk === true &&
      g.score > 0 &&
      g.kolCount + g.smartCount >= 1 &&
      g.lastSmartTs != null,
  );
  return rankGems(watched).slice(0, n);
}
