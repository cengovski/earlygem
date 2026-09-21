import { uniqueFills } from "./tape-key";
import type { TapeFill } from "./types";
import { WINDOW_MIN } from "./window";

let stack: TapeFill[] = [];

export function stackTape(incoming: TapeFill[], windowMin = WINDOW_MIN) {
  const since = Date.now() - windowMin * 60_000;
  stack = uniqueFills([...stack, ...incoming]).filter((row) => row.ts >= since && row.side === "buy");
  return stack;
}

export function peekStackedTape() {
  return stack;
}
