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

export function walletId(chain: string, address: string) {
  const addr = address.trim();
  if (chain === "solana") return `solana:${addr}`;
  return `${chain}:${addr.toLowerCase()}`;
}

export function traderWalletId(t: Trader) {
  const chain = t.smartReasons.find((s) => s.startsWith("chain:"))?.slice(6);
  if (t.solana) return walletId("solana", t.solana);
  if (t.address) return walletId(chain || "evm", t.address);
  return `h:${t.handle.toLowerCase()}`;
}

/** Same chain+address once. Nansen label wins over a pasted stub. */
export function mergeFollow(a: Trader[], b: Trader[]) {
  const map = new Map<string, Trader>();
  for (const t of [...a, ...b]) {
    const k = traderWalletId(t);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...t, smartReasons: [...t.smartReasons] });
      continue;
    }
    const nansen = t.smartReasons.includes("src:nansen");
    if (nansen) {
      prev.handle = t.handle || prev.handle;
      prev.displayName = t.displayName || prev.displayName;
      prev.profileUrl = t.profileUrl || prev.profileUrl;
      prev.smartScore = Math.max(prev.smartScore, t.smartScore);
    }
    prev.solana = prev.solana || t.solana;
    prev.address = prev.address || t.address;
    prev.smartReasons = [...new Set([...prev.smartReasons, ...t.smartReasons])];
  }
  return [...map.values()];
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
