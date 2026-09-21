import Link from "next/link";
import type { ReactNode } from "react";
import type { ChainLane } from "@/lib/chains";
import type { Gem } from "@/lib/types";
import { GemCard } from "./GemCard";

export function ChainLaneSection({
  lane,
  gems,
  extra,
}: {
  lane: ChainLane;
  gems: Gem[];
  extra?: ReactNode;
}) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-medium">
            {lane.short} · {lane.title}
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-mute">{lane.blurb}</p>
        </div>
        <div className="flex items-center gap-3">
          {extra}
          <Link href={`/gems?chain=${lane.id}`} className="text-sm text-mute hover:text-accent">
            {lane.short} tümü →
          </Link>
        </div>
      </div>
      {gems.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {gems.map((g) => (
            <GemCard key={g.id} gem={g} />
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-line bg-surface p-5 text-sm text-mute">
          {lane.source === "pulse"
            ? "Bu ağda şu an tape alış yok."
            : `${lane.short} izlemede taze havuz yok. DexScreener boş döndü.`}
        </p>
      )}
    </section>
  );
}
