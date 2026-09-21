import type { Gem } from "./types";

const BLOCK = new Set(
  [
    "0x5ff67ea3c7acd278f1b2e4254448295193735302", // FEELSDOGE UNI-V2 pair posted as token
    "0xee51e373bc9ad029c24065eff66da879ecc3b1f6", // FEELSDOGE mint
  ].map((x) => x.toLowerCase()),
);

const LP_TICKER = /^(uni-?v2|cake-?lp|slp|lp)$/i;
const LP_NAME = /uniswap v2|pancake pair|liquidity provider|pair token/i;

export function addrKey(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

export function scamReasons(gem: Pick<Gem, "token" | "symbol" | "name" | "pairUrl" | "mcap" | "liquidity" | "change24" | "boughtUsd" | "soldUsd" | "buyers" | "kolCount">): string[] {
  const reasons: string[] = [];
  const token = addrKey(gem.token);
  const pair = addrKey(gem.pairUrl?.split("/").pop() || "");
  if (BLOCK.has(token) || BLOCK.has(pair)) reasons.push("blocklist");
  if (LP_TICKER.test(gem.symbol || "") || LP_NAME.test(gem.name || "")) reasons.push("LP token");
  const liq = gem.liquidity || 0;
  const mcap = gem.mcap || 0;
  const ch = gem.change24 || 0;
  const bought = gem.boughtUsd || 0;
  const sold = gem.soldUsd || 0;
  if (liq > 0 && mcap > 0 && mcap / liq > 12 && liq < 25_000) reasons.push("ince havuz / şiş cap");
  if (ch >= 800) reasons.push("aşırı pompa");
  if (bought > 0 && sold / bought < 0.04 && (gem.buyers || 0) >= 8) reasons.push("tek yön alım");
  if ((gem.kolCount || 0) >= 10 && ch >= 400 && liq < 30_000) reasons.push("küme farm");
  return reasons;
}

export function isScamGem(gem: Gem): boolean {
  return scamReasons(gem).length > 0;
}
