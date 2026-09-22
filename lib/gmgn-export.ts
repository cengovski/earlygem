import { chainLabel } from "./format";
import { nansenCachedTraders } from "./nansen";
import type { ChainId } from "./types";
import { mergeFollow, watchTraders } from "./watchlist";

/** GMGN follow bulk import/export: https://docs.gmgn.ai/index/wallets-import-export */
export type GmgnWalletRow = {
  address: string;
  name: string;
  emoji: string;
};

export type FollowedWallet = {
  chain: ChainId;
  address: string;
  handle: string;
  source: "nansen" | "watch";
};

const CHAINS: ChainId[] = ["solana", "bsc", "base", "ethereum", "robinhood", "monad"];
export const GMGN_IMPORT_MAX = 2000;

function chainOf(t: { solana: string | null; address: string | null; smartReasons: string[] }): ChainId | null {
  const hit = t.smartReasons.find((s) => s.startsWith("chain:"));
  if (hit) {
    const id = hit.slice(6) as ChainId;
    if (CHAINS.includes(id)) return id;
  }
  if (t.solana) return "solana";
  return null;
}

/** Same set GMGN `wallet_activity` follows: pasted Solana list + Nansen roster. */
export function followedWallets(): FollowedWallet[] {
  const traders = mergeFollow(watchTraders(), nansenCachedTraders());
  const out: FollowedWallet[] = [];
  const seen = new Set<string>();
  for (const t of traders) {
    const chain = chainOf(t);
    const address = chain === "solana" ? t.solana : t.address;
    if (!chain || !address) continue;
    const k = `${chain}:${address.toLowerCase()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const nansen = t.smartReasons.includes("src:nansen");
    out.push({
      chain,
      address,
      handle: (t.handle || address.slice(0, 8)).replace(/^@/, ""),
      source: nansen ? "nansen" : "watch",
    });
  }
  out.sort((a, b) => CHAINS.indexOf(a.chain) - CHAINS.indexOf(b.chain) || a.handle.localeCompare(b.handle));
  return out;
}

export function gmgnWalletRows(wallets: FollowedWallet[], opts?: { withChain?: boolean }): GmgnWalletRow[] {
  const withChain = opts?.withChain ?? wallets.some((w) => w.chain !== wallets[0]?.chain);
  return wallets.slice(0, GMGN_IMPORT_MAX).map((w) => {
    const tag = w.source === "nansen" ? "NANSEN" : "WATCH";
    const who = w.handle && w.handle.toLowerCase() !== w.address.toLowerCase() ? w.handle : w.address.slice(0, 8);
    const name = withChain ? `${tag} ${chainLabel(w.chain)} ${who}` : `${tag} ${who}`;
    return {
      address: w.address,
      name: name.slice(0, 48).trim(),
      emoji: w.source === "nansen" ? "📡" : "👀",
    };
  });
}

export function gmgnExportJson(wallets: FollowedWallet[], opts?: { withChain?: boolean }) {
  return `${JSON.stringify(gmgnWalletRows(wallets, opts), null, 2)}\n`;
}

export function followCounts(wallets = followedWallets()) {
  const map = new Map<ChainId, number>();
  for (const row of wallets) map.set(row.chain, (map.get(row.chain) || 0) + 1);
  return CHAINS.filter((c) => map.get(c)).map((c) => ({ chain: c, n: map.get(c) || 0 }));
}
