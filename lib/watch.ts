import { clusterHits, type AlertHit } from "./alert-msg";
import type { TapeFill } from "./types";

export type AlertRule = {
  windowMin: number;
  minUsd: number;
  minBuys: number;
};

export function serverRule(): AlertRule {
  return {
    windowMin: Number(process.env.ALERT_WINDOW_MIN) || 10,
    minUsd: Number(process.env.ALERT_MIN_USD) || 1000,
    minBuys: Number(process.env.ALERT_MIN_BUYS) || 5,
  };
}

export const DEFAULT_RULE: AlertRule = { windowMin: 10, minUsd: 1000, minBuys: 5 };

export function loadRule(): AlertRule {
  return serverRule();
}

export function saveRule(_rule: AlertRule) {}

export function clustersFromTape(tape: TapeFill[], rule: AlertRule): AlertHit[] {
  return clusterHits(tape, rule.windowMin, rule.minUsd, rule.minBuys);
}
