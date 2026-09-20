import { GemCard } from "@/components/GemCard";
import { Shell } from "@/components/Shell";
import { fetchAllGems } from "@/lib/sources";

export const revalidate = 30;

export default async function GemsPage({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const { chain } = await searchParams;
  const all = await fetchAllGems();
  const rows = chain ? all.filter((g) => g.chain === chain) : all;
  return (
    <Shell title="Erken gemler" subtitle="Yeni havuz, izlenen alici, net alis, dusuk mcap. RH = FOMO kume. SOL/BASE = DexScreener.">
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[["hepsi", "/gems"], ["robinhood", "/gems?chain=robinhood"], ["solana", "/gems?chain=solana"], ["base", "/gems?chain=base"]].map(([label, href]) => (
          <a key={href} href={href} className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">{label}</a>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{rows.map((g) => <GemCard key={g.id} gem={g} />)}</div>
    </Shell>
  );
}
