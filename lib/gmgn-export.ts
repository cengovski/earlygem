import { chainLabel } from "./format";
import type { ChainId } from "./types";
import { readWalletPool, type WalletSource } from "./wallet-pool";

/** GMGN follow bulk import/export: https://docs.gmgn.ai/index/wallets-import-export */
export type GmgnWalletRow = {
  address: string;
  name: string;
  emoji: string;
};

export type ExportChain = ChainId | "evm";

export type FollowedWallet = {
  chain: ExportChain;
  address: string;
  handle: string;
  source: WalletSource;
  family: "solana" | "evm";
};

const ORDER: ExportChain[] = [
  "solana",
  "bsc",
  "base",
  "ethereum",
  "robinhood",
  "monad",
  "arbitrum",
  "hyperevm",
  "megaeth",
  "xlayer",
  "stable",
  "arc",
  "evm",
];

export const GMGN_IMPORT_MAX = 2000;

const TAG: Record<WalletSource, string> = {
  nansen: "NANSEN",
  binance: "BN",
  pulse: "PULSE",
  fomo: "FOMO",
  pump: "PUMP",
  cabal: "CABAL",
  madeon: "MADEON",
  soltrack: "WHALE",
  gmgn: "GMGN",
  tape: "TAPE",
  known: "KNOWN",
  watch: "WATCH",
};

const EMOJI: Record<WalletSource, string> = {
  nansen: "📡",
  binance: "🟡",
  pulse: "💚",
  fomo: "🔥",
  pump: "🐸",
  cabal: "🕵️",
  madeon: "☀️",
  soltrack: "🐋",
  gmgn: "👁️",
  tape: "📈",
  known: "⭐",
  watch: "👀",
};

export function exportChainLabel(chain: ExportChain) {
  if (chain === "evm") return "EVM";
  return chainLabel(chain);
}

/** Pool rows expanded per observed chain. Chainless EVM stays in the `evm` bucket. */
export function followedWallets(): FollowedWallet[] {
  const out: FollowedWallet[] = [];
  for (const row of readWalletPool()) {
    const handle = (row.handle || row.address.slice(0, 8)).replace(/^@/, "");
    if (row.family === "solana") {
      out.push({ chain: "solana", address: row.address, handle, source: row.primary, family: "solana" });
      continue;
    }
    const chains = row.chains.filter((c) => c !== "solana" && c !== "unknown");
    if (!chains.length) {
      out.push({ chain: "evm", address: row.address, handle, source: row.primary, family: "evm" });
      continue;
    }
    for (const chain of chains) {
      out.push({ chain, address: row.address, handle, source: row.primary, family: "evm" });
    }
  }
  return out;
}

export function gmgnWalletRows(wallets: FollowedWallet[], opts?: { withChain?: boolean }): GmgnWalletRow[] {
  const withChain = opts?.withChain ?? wallets.some((w) => w.chain !== wallets[0]?.chain);
  return wallets.slice(0, GMGN_IMPORT_MAX).map((w) => {
    const who = w.handle && w.handle.toLowerCase() !== w.address.toLowerCase() ? w.handle : w.address.slice(0, 8);
    const name = withChain ? `${TAG[w.source]} ${exportChainLabel(w.chain)} ${who}` : `${TAG[w.source]} ${who}`;
    return {
      address: w.address,
      name: name.slice(0, 48).trim(),
      emoji: EMOJI[w.source] || "👀",
    };
  });
}

export function gmgnExportJson(wallets: FollowedWallet[], opts?: { withChain?: boolean }) {
  return `${JSON.stringify(gmgnWalletRows(wallets, opts), null, 2)}\n`;
}

export function followCounts(wallets = followedWallets()) {
  const map = new Map<ExportChain, number>();
  for (const row of wallets) map.set(row.chain, (map.get(row.chain) || 0) + 1);
  return ORDER.filter((c) => map.get(c)).map((c) => ({ chain: c, n: map.get(c) || 0 }));
}
