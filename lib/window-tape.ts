import { uniqueFills } from "./tape-key";
import type { TapeFill } from "./types";

let stack: TapeFill[] = [];

export function stackTape(incoming: TapeFill[], windowMin = 10) {
  const since = Date.now() - windowMin * 60_000;
  stack = uniqueFills([...stack, ...incoming]).filter((row) => row.ts >= since && row.side === "buy");
  return stack;
}

export function peekStackedTape() {
  return stack;
}
