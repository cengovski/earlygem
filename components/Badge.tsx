import { chainLabel, clsx } from "@/lib/format";
import type { ChainId } from "@/lib/types";

export function ChainBadge({ chain }: { chain: ChainId }) {
  const tone = chain === "solana" ? "bg-[#3b2a6b]/50 text-[#d7c7ff]" : chain === "robinhood" ? "bg-[#1d3a18]/70 text-[#b6ff8a]" : "bg-[#2a2618] text-mute";
  return <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", tone)}>{chainLabel(chain)}</span>;
}

export function SideBadge({ side }: { side: "buy" | "sell" }) {
  return <span className={side === "buy" ? "font-medium text-buy" : "font-medium text-sell"}>{side === "buy" ? "AL" : "SAT"}</span>;
}
