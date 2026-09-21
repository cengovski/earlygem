import type { TapeFill } from "./types";

function person(row: TapeFill) {
  return (row.handle || row.wallet || "").toLowerCase().replace(/^@/, "");
}

export function fillKey(row: TapeFill) {
  if (row.tx) return `tx:${row.tx.toLowerCase()}`;
  return [
    "ca",
    row.token.toLowerCase(),
    person(row),
    row.side,
    Math.round(row.usd),
    Math.floor(row.ts / 30_000),
  ].join(":");
}

export function uniqueFills(rows: TapeFill[]) {
  const seen = new Set<string>();
  const people = new Set<string>();
  const collide = new Set<string>();
  const out: TapeFill[] = [];
  for (const row of rows) {
    const k = fillKey(row);
    if (seen.has(k)) continue;
    const who = person(row);
    const ident = who ? `who:${who}:${row.token.toLowerCase()}:${row.side}:${Math.floor(row.ts / 30_000)}` : "";
    if (ident && people.has(ident)) continue;
    const bump = `${row.token.toLowerCase()}:${who}:${row.side}:${Math.round(row.usd / 5) * 5}:${Math.floor(row.ts / 45_000)}`;
    if (who && collide.has(bump)) continue;
    seen.add(k);
    if (ident) people.add(ident);
    if (who) collide.add(bump);
    out.push(row);
  }
  return out;
}
