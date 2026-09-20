import type { ChainId } from "./types";

export function usd(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  if (abs >= 1000) return `${sign}$${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`;
  if (abs >= 0.0001) return `${sign}$${abs.toFixed(4)}`;
  return `${sign}$${abs.toExponential(2)}`;
}

export function compact(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function pct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

export function ago(ts: number | null | undefined): string {
  if (!ts) return "—";
  const ms = ts > 10_000_000_000 ? ts : ts * 1000;
  const diff = Date.now() - ms;
  if (diff < 0) return "simdi";
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}sa`;
  return `${Math.floor(h / 24)}g`;
}

export function shortAddr(addr: string | null | undefined, n = 4): string {
  if (!addr) return "—";
  if (addr.length <= n * 2 + 3) return addr;
  return `${addr.slice(0, n + (addr.startsWith("0x") ? 2 : 0))}…${addr.slice(-n)}`;
}

export function chainLabel(chain: ChainId): string {
  if (chain === "robinhood") return "RH";
  if (chain === "solana") return "SOL";
  if (chain === "base") return "BASE";
  if (chain === "bsc") return "BSC";
  return "ETH";
}

export function explorerWallet(chain: ChainId, addr: string): string {
  if (chain === "solana") return `https://solscan.io/account/${addr}`;
  if (chain === "robinhood") return `https://robinhoodchain.blockscout.com/address/${addr}`;
  if (chain === "base") return `https://basescan.org/address/${addr}`;
  if (chain === "bsc") return `https://bscscan.com/address/${addr}`;
  return `https://etherscan.io/address/${addr}`;
}

export function explorerToken(chain: ChainId, addr: string): string {
  if (chain === "solana") return `https://solscan.io/token/${addr}`;
  if (chain === "robinhood") return `https://robinhoodchain.blockscout.com/token/${addr}`;
  return `https://dexscreener.com/${chain}/${addr}`;
}

export function dexUrl(chain: ChainId, addr: string, pairUrl?: string | null): string {
  if (pairUrl) return pairUrl;
  const slug = chain === "robinhood" ? "robinhood" : chain;
  return `https://dexscreener.com/${slug}/${addr}`;
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
