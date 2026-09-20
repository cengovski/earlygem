import type { Gem } from "./types";

const HOUR = 60 * 60 * 1000;

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
}): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 20;
  const created = input.pairCreatedAt
    ? input.pairCreatedAt < 10_000_000_000
      ? input.pairCreatedAt * 1000
      : input.pairCreatedAt
    : null;
  const ageMs = created ? Date.now() - created : null;
  if (ageMs != null && ageMs < 3 * HOUR) {
    score += 28;
    reasons.push("havuz < 3 saat");
  } else if (ageMs != null && ageMs < 24 * HOUR) {
    score += 16;
    reasons.push("havuz < 24 saat");
  } else if (ageMs != null && ageMs < 3 * 24 * HOUR) {
    score += 8;
    reasons.push("havuz < 3 gun");
  }
  if (input.mcap != null && input.mcap > 0 && input.mcap < 250_000) {
    score += 18;
    reasons.push("mikro cap");
  } else if (input.mcap != null && input.mcap < 1_500_000) {
    score += 10;
    reasons.push("low cap");
  }
  if (input.buyers >= 8) {
    score += 14;
    reasons.push(`${input.buyers} izlenen alici`);
  } else if (input.buyers >= 3) {
    score += 8;
    reasons.push(`${input.buyers} alici kumesi`);
  }
  if (input.firstBuyer) {
    score += 6;
    reasons.push(`ilk alici ${input.firstBuyer}`);
  }
  if (input.boughtUsd > 0 && input.soldUsd / input.boughtUsd < 0.15) {
    score += 10;
    reasons.push("satis zayif / tutuyorlar");
  }
  if (input.liquidity != null && input.liquidity >= 20_000 && input.liquidity < 400_000) {
    score += 6;
    reasons.push("islenebilir LP");
  }
  if (input.change24 != null && input.change24 > 80 && input.change24 < 800) {
    score += 4;
    reasons.push("hizli ama henuz parabol degil");
  }
  if (input.liquidity != null && input.liquidity < 3000) {
    score -= 20;
    reasons.push("olu / toz havuz");
  }
  return { score: Math.max(0, Math.min(99, Math.round(score))), reasons };
}

export function rankGems(gems: Gem[]): Gem[] {
  return [...gems].sort((a, b) => b.score - a.score || b.buyers - a.buyers);
}
