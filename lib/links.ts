import type { ChainId } from "./types";
import { dexUrl } from "./format";

/** GMGN path: gmgn.ai/{slug}/token/{address} */
function gmgnSlug(chain: ChainId): string {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "robinhood") return "robinhood";
  if (chain === "monad") return "monad";
  return chain;
}

/** BasedBot web: basedbot.app/token/{slug}/{address} */
function basedSlug(chain: ChainId): string {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "robinhood") return "robinhood";
  if (chain === "monad") return "monad";
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
    { label: "BasedBot", href: `https://basedbot.app/token/${basedSlug(chain)}/${address}` },
    { label: "BananaGun", href: banana },
    { label: "Maestro", href: `https://t.me/MaestroSniperBot?start=${address}` },
    { label: "Twitter", href: `https://twitter.com/search?q=${q}` },
  ];
}
