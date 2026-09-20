import type { ChainId } from "./types";
import { dexUrl } from "./format";

function gmgnSlug(chain: ChainId): string {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "robinhood") return "rhc";
  return chain;
}

export type ToolLink = { label: string; href: string };

export function tokenToolLinks(chain: ChainId, address: string, pairUrl?: string | null): ToolLink[] {
  const q = encodeURIComponent(address);
  const banana =
    chain === "solana"
      ? `https://t.me/BananaGunSolana_bot?start=snp_${address}`
      : `https://t.me/BananaGunSniper_bot?start=snp_${address}`;
  return [
    { label: "DexScreener", href: dexUrl(chain, address, pairUrl) },
    { label: "GMGN", href: `https://gmgn.ai/${gmgnSlug(chain)}/token/${address}` },
    { label: "BananaGun", href: banana },
    { label: "Maestro", href: `https://t.me/MaestroSniperBot?start=${address}` },
    { label: "BasedBot", href: `https://t.me/based_eth_bot?start=${address}` },
    { label: "Twitter", href: `https://twitter.com/search?q=${q}` },
  ];
}
