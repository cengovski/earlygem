import type { SmartKind, Trader } from "./types";

/** FOMO app rank + followers + tape edge. Profile signer is not this wallet. */
export function classifyTrader(input: {
  handle?: string;
  followers: number;
  rank: number | null;
  volume: number;
  realized: number;
  unrealized: number;
  wins: number;
  trips: number;
  fills: number;
}): { kind: SmartKind; smartScore: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const fol = input.followers || 0;
  const rank = input.rank;
  const vol = input.volume || 0;
  const pnl = (input.realized || 0) + (input.unrealized || 0);
  const trips = input.trips || 0;
  const wr = trips > 0 ? input.wins / trips : 0;

  if (fol >= 80_000) {
    score += 28;
    reasons.push(`${Math.round(fol / 1000)}k takipçi`);
  } else if (fol >= 25_000) {
    score += 18;
    reasons.push("yüksek takip");
  } else if (fol >= 8_000) {
    score += 8;
    reasons.push("görünür hesap");
  }

  if (rank != null && rank > 0 && rank <= 12) {
    score += 24;
    reasons.push(`tape rank #${rank}`);
  } else if (rank != null && rank <= 30) {
    score += 14;
    reasons.push(`top 30 #${rank}`);
  } else if (rank != null && rank <= 80) {
    score += 6;
    reasons.push(`izlenen #${rank}`);
  }

  if (vol >= 1_000_000) {
    score += 14;
    reasons.push("yüksek tape hacmi");
  } else if (vol >= 250_000) {
    score += 8;
    reasons.push("aktif tape hacmi");
  }

  if (pnl >= 5_000_000) {
    score += 10;
    reasons.push("açık PnL büyük");
  } else if (pnl >= 500_000) {
    score += 5;
  }

  if (trips >= 3 && wr >= 0.55) {
    score += 12;
    reasons.push(`tur ${input.wins}/${trips}`);
  }

  if ((input.fills || 0) >= 80) {
    score += 6;
    reasons.push("sık fill");
  } else if ((input.fills || 0) >= 25) {
    score += 3;
  }

  score = Math.max(0, Math.min(99, Math.round(score)));

  const kol = fol >= 25_000 && (score >= 28 || (rank != null && rank <= 40) || vol >= 150_000);
  const smart = !kol && (score >= 32 || (rank != null && rank <= 25) || (trips >= 3 && wr >= 0.6 && vol >= 80_000));
  const active = !kol && !smart && (input.fills || 0) >= 8;
  const kind: SmartKind = kol ? "kol" : smart ? "smart" : active ? "active" : "noise";
  return { kind, smartScore: score, reasons: reasons.slice(0, 4) };
}

export function isWatchedKind(kind: SmartKind | null | undefined): boolean {
  return kind === "kol" || kind === "smart";
}

export function traderIndex(traders: Trader[]): Map<string, Trader> {
  const map = new Map<string, Trader>();
  for (const t of traders) map.set(t.handle.toLowerCase(), t);
  return map;
}

export function pickSmartRoster(traders: Trader[], limit = 16): Trader[] {
  return [...traders]
    .filter((t) => isWatchedKind(t.kind))
    .sort((a, b) => {
      const ka = a.kind === "kol" ? 2 : 1;
      const kb = b.kind === "kol" ? 2 : 1;
      return kb - ka || b.smartScore - a.smartScore || b.followers - a.followers;
    })
    .slice(0, limit);
}
