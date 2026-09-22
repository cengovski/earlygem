import { loadClientKeys } from "./client-keys";
import type { Trader } from "./types";

/** Base58 Solana address, not EVM. */
export function isSolWallet(raw: string) {
  const s = raw.trim();
  return s.length >= 32 && s.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(s) && !s.startsWith("0x");
}

export function isEvmWallet(raw: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(raw.trim());
}

export function parseWatchSol(raw?: string) {
  const text = raw || loadClientKeys().watchSol || process.env.WATCH_SOL || "";
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of text.split(/[\s,;]+/)) {
    if (!isSolWallet(part)) continue;
    if (seen.has(part)) continue;
    seen.add(part);
    out.push(part);
  }
  return out;
}

export function watchTraders(): Trader[] {
  return parseWatchSol().map((solana) => ({
    handle: solana.slice(0, 8),
    address: null,
    solana,
    displayName: solana.slice(0, 8),
    avatarUrl: null,
    followers: 0,
    clan: null,
    profileUrl: `https://gmgn.ai/sol/address/${solana}`,
    fills: 0,
    volume: 0,
    realized: 0,
    unrealized: 0,
    wins: 0,
    trips: 0,
    openTokens: 0,
    rank: null,
    lastTs: null,
    kind: "smart",
    smartScore: 70,
    smartReasons: ["src:watch"],
  }));
}
