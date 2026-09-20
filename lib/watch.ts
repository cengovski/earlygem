import { clusterHits, type AlertHit } from "./alert-msg";
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

export function clustersFromTape(tape: TapeFill[], rule: AlertRule): AlertHit[] {
  return clusterHits(tape, rule.windowMin, rule.minUsd, rule.minBuys);
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
