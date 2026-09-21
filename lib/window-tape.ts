import { uniqueFills } from "./tape-key";
import { ingestPool, readPool } from "./pool";
import type { TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

/** Ingest into the persisted 10m browser pool and return the filtered tape. */
export function stackTape(incoming: TapeFill[], windowMin = WINDOW_MIN) {
  return ingestPool(incoming, windowMin);
}

export function peekStackedTape() {
  return readPool();
}
