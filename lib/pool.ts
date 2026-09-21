import { uniqueFills } from "./tape-key";
import type { TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

const KEY = "eg_10m_pool";
const MAX = 600;

type Stored = { fills: TapeFill[] };

function load(): TapeFill[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null") as Stored | TapeFill[] | null;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.fills)) return raw.fills;
  } catch {
    /* empty */
  }
  return [];
}

function save(fills: TapeFill[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ fills }));
  } catch {
    /* quota */
  }
}

function prune(rows: TapeFill[], windowMin = WINDOW_MIN) {
  const since = Date.now() - windowMin * 60_000;
  return uniqueFills(rows)
    .filter((row) => row.side === "buy" && row.ts >= since)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, MAX);
}

/** Merge incoming fills into the 10-minute browser pool, drop collisions, persist. */
export function ingestPool(incoming: TapeFill[], windowMin = WINDOW_MIN) {
  const next = prune([...load(), ...incoming], windowMin);
  save(next);
  return next;
}

export function readPool(windowMin = WINDOW_MIN) {
  return prune(load(), windowMin);
}

export function clearPool() {
  save([]);
}

export function poolSize() {
  return readPool().length;
}
