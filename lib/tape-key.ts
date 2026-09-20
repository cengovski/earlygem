import type { TapeFill } from "./types";

export function fillKey(row: TapeFill) {
  if (row.tx) return `${row.chain}:${row.tx.toLowerCase()}`;
  return [
    row.chain,
    row.token.toLowerCase(),
    (row.wallet || row.handle || "").toLowerCase(),
    row.side,
    Math.round(row.usd),
    Math.floor(row.ts / 20_000),
  ].join(":");
}

export function uniqueFills(rows: TapeFill[]) {
  const seen = new Set<string>();
  const out: TapeFill[] = [];
  for (const row of rows) {
    const k = fillKey(row);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
  }
  return out;
}
