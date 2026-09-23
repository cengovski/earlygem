import { scrubFillLabels } from "./alert-msg";
import { overlayCachedDex } from "./dexmeta";
import { persistGet, persistSet } from "./persist";
import { uniqueFills } from "./tape-key";
import type { TapeFill } from "./types";
import { noteTapeFills } from "./wallet-pool";
import { WINDOW_MIN } from "./window";

const KEY = "eg_10m_pool";
const MAX = 1200;

type Stored = { fills: TapeFill[] };

function load(): TapeFill[] {
  try {
    const raw = JSON.parse(persistGet(KEY) || "null") as Stored | TapeFill[] | null;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.fills)) return raw.fills;
  } catch {
    /* empty */
  }
  return [];
}

function save(fills: TapeFill[]) {
  persistSet(KEY, JSON.stringify({ fills }));
}

function prune(rows: TapeFill[], windowMin = WINDOW_MIN) {
  const since = Date.now() - windowMin * 60_000;
  return overlayCachedDex(
    uniqueFills(rows.map(scrubFillLabels))
      .filter((row) => row.side === "buy" && row.ts >= since)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, MAX),
  );
}

/** Merge incoming fills into the 20-minute browser pool, drop collisions, persist. */
export function ingestPool(incoming: TapeFill[], windowMin = WINDOW_MIN) {
  try {
    noteTapeFills(incoming);
  } catch {
    /* wallet pool must not break the tape */
  }
  const next = prune([...load(), ...incoming], windowMin);
  save(next);
  return next;
}

export function readPool(windowMin = WINDOW_MIN) {
  return prune(load(), windowMin);
}

export function writePool(fills: TapeFill[], windowMin = WINDOW_MIN) {
  const next = prune(fills, windowMin);
  save(next);
  return next;
}

export function clearPool() {
  save([]);
}

export function poolSize() {
  return readPool().length;
}
