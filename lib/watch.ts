import { clusterHits, type AlertHit } from "./alert-msg";
import { persistGet, persistSet } from "./persist";
import type { TapeFill } from "./types";

export type AlertRule = {
  windowMin: number;
  minUsd: number;
  minBuys: number;
};

export const DEFAULT_RULE: AlertRule = { windowMin: 20, minUsd: 1000, minBuys: 5 };
const RULE_KEY = "eg_alert_rule";

export function serverRule(): AlertRule {
  return loadRule();
}

export function loadRule(): AlertRule {
  try {
    const raw = persistGet(RULE_KEY);
    if (!raw) {
      return {
        windowMin: Number(process.env.ALERT_WINDOW_MIN) || DEFAULT_RULE.windowMin,
        minUsd: Number(process.env.ALERT_MIN_USD) || DEFAULT_RULE.minUsd,
        minBuys: Number(process.env.ALERT_MIN_BUYS) || DEFAULT_RULE.minBuys,
      };
    }
    const parsed = JSON.parse(raw) as Partial<AlertRule>;
    const windowMin = Number(parsed.windowMin) || DEFAULT_RULE.windowMin;
    return {
      windowMin: windowMin === 10 ? DEFAULT_RULE.windowMin : windowMin,
      minUsd: Number(parsed.minUsd) || DEFAULT_RULE.minUsd,
      minBuys: Number(parsed.minBuys) || DEFAULT_RULE.minBuys,
    };
  } catch {
    return DEFAULT_RULE;
  }
}

export function saveRule(rule: AlertRule) {
  persistSet(RULE_KEY, JSON.stringify(rule));
}

export function clustersFromTape(tape: TapeFill[], rule: AlertRule): AlertHit[] {
  return clusterHits(tape, rule.windowMin, rule.minUsd, rule.minBuys);
}
