import { buyerSource, type BuyerSrc } from "@/lib/alert-msg";
import { chainLabel, clsx } from "@/lib/format";
import type { ChainId, SmartKind } from "@/lib/types";

export function ChainBadge({ chain }: { chain: ChainId }) {
  const tone =
    chain === "solana"
      ? "bg-[#3b2a6b]/50 text-[#d7c7ff]"
      : chain === "robinhood"
        ? "bg-[#1d3a18]/70 text-[#b6ff8a]"
        : "bg-[#2a2618] text-mute";
  return (
    <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase", tone)}>
      {chainLabel(chain)}
    </span>
  );
}

export function SideBadge({ side }: { side: "buy" | "sell" }) {
  return (
    <span className={side === "buy" ? "font-medium text-buy" : "font-medium text-sell"}>
      {side === "buy" ? "AL" : "SAT"}
    </span>
  );
}

const SRC_TONE: Record<BuyerSrc, string> = {
  KOL: "bg-accent text-[#16140c]",
  SMART: "bg-[#2a4a22] text-[#b6ff8a]",
  NANSEN: "bg-[#1d3a4a] text-[#9ad8ff]",
  BINANCE: "bg-[#3a3210] text-[#f3d36a]",
  PUMP: "bg-[#3a1d18] text-[#ffb08a]",
  AXIOM: "bg-[#2a1840] text-[#d7c7ff]",
};

export function SmartBadge({
  kind,
  flags,
}: {
  kind?: SmartKind | null;
  flags?: string[];
}) {
  const src = flags?.length ? buyerSource({ flags, smartKind: kind }) : null;
  if (src) {
    return (
      <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", SRC_TONE[src])}>
        {src}
      </span>
    );
  }
  if (!kind || kind === "noise") return null;
  const label = kind === "kol" ? "KOL" : kind === "smart" ? "SMART" : "AKTİF";
  const tone =
    kind === "kol"
      ? SRC_TONE.KOL
      : kind === "smart"
        ? SRC_TONE.SMART
        : "bg-[#2a2618] text-mute";
  return <span className={clsx("rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide", tone)}>{label}</span>;
}
