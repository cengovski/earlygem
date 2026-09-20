import type { TapeFill } from "./types";

const fired = new Map<string, number>();

export type AlertRule = {
  windowMin: number;
  minUsd: number;
  minBuys: number;
};

export const DEFAULT_RULE: AlertRule = { windowMin: 3, minUsd: 2500, minBuys: 3 };

export function loadRule(): AlertRule {
  if (typeof window === "undefined") return DEFAULT_RULE;
  try {
    const raw = window.localStorage.getItem("earlygem.alert");
    if (!raw) return DEFAULT_RULE;
    const parsed = JSON.parse(raw) as Partial<AlertRule>;
    return {
      windowMin: Number(parsed.windowMin) || DEFAULT_RULE.windowMin,
      minUsd: Number(parsed.minUsd) || DEFAULT_RULE.minUsd,
      minBuys: Number(parsed.minBuys) || DEFAULT_RULE.minBuys,
    };
  } catch {
    return DEFAULT_RULE;
  }
}

export function saveRule(rule: AlertRule) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("earlygem.alert", JSON.stringify(rule));
}

export function clustersFromTape(tape: TapeFill[], rule: AlertRule) {
  const since = Date.now() - rule.windowMin * 60_000;
  const bag = new Map<string, { token: string; chain: TapeFill["chain"]; symbol: string; usd: number; buys: number }>();
  for (const row of tape) {
    if (row.side !== "buy" || row.ts < since) continue;
    const key = `${row.chain}:${row.token.toLowerCase()}`;
    const prev = bag.get(key) || { token: row.token, chain: row.chain, symbol: row.symbol, usd: 0, buys: 0 };
    prev.usd += row.usd || 0;
    prev.buys += 1;
    bag.set(key, prev);
  }
  return [...bag.values()].filter((row) => row.usd >= rule.minUsd && row.buys >= rule.minBuys);
}

export async function fireTapeAlerts(tape: TapeFill[]) {
  if (typeof window === "undefined") return;
  const rule = loadRule();
  const hits = clustersFromTape(tape, rule);
  for (const hit of hits) {
    const key = `${hit.chain}:${hit.token.toLowerCase()}`;
    const prev = fired.get(key) || 0;
    if (Date.now() - prev < 15 * 60_000) continue;
    fired.set(key, Date.now());
    if (fired.size > 40) {
      const cutoff = Date.now() - 15 * 60_000;
      for (const [k, ts] of fired) if (ts < cutoff) fired.delete(k);
    }
    await fetch("/api/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...hit, windowMin: rule.windowMin }),
    }).catch(() => null);
  }
}
