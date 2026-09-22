import { buyerSource, SRC_RANK } from "./alert-msg";
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

function mergeFill(a: TapeFill, b: TapeFill): TapeFill {
  const base = SRC_RANK[buyerSource(b)] > SRC_RANK[buyerSource(a)] ? b : a;
  const other = base === a ? b : a;
  return {
    ...base,
    flags: [...new Set([...a.flags, ...b.flags])],
    usd: Math.max(a.usd || 0, b.usd || 0),
    mcap: [a.mcap, b.mcap].filter((n): n is number => typeof n === "number" && n > 0).sort((x, y) => y - x)[0] || null,
    liquidity: base.liquidity || other.liquidity,
    change24: base.change24 ?? other.change24,
    handle: base.handle || other.handle,
    wallet: base.wallet || other.wallet,
    name: base.name && base.name !== base.symbol ? base.name : other.name || base.name,
  };
}

export function uniqueFills(rows: TapeFill[]) {
  const byKey = new Map<string, number>();
  const byIdent = new Map<string, number>();
  const byBump = new Map<string, number>();
  const out: TapeFill[] = [];
  const index = (k: string, ident: string, bump: string, i: number) => {
    byKey.set(k, i);
    if (ident) byIdent.set(ident, i);
    if (bump) byBump.set(bump, i);
  };
  for (const row of rows) {
    const k = fillKey(row);
    const who = person(row);
    const ident = who ? `who:${who}:${row.token.toLowerCase()}:${row.side}:${Math.floor(row.ts / 30_000)}` : "";
    const bump = who
      ? `${row.token.toLowerCase()}:${who}:${row.side}:${Math.round(row.usd / 5) * 5}:${Math.floor(row.ts / 45_000)}`
      : "";
    const hit = byKey.get(k) ?? (ident ? byIdent.get(ident) : undefined) ?? (bump ? byBump.get(bump) : undefined);
    if (hit != null) {
      out[hit] = mergeFill(out[hit], row);
      index(k, ident, bump, hit);
      continue;
    }
    out.push(row);
    index(k, ident, bump, out.length - 1);
  }
  return out;
}
