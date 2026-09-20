import { GemCard } from "@/components/GemCard";
import { Shell } from "@/components/Shell";
import { fetchRadarBundle } from "@/lib/sources";

export const revalidate = 25;

export default async function GemsPage({
  searchParams,
}: {
  searchParams: Promise<{ chain?: string; view?: string }>;
}) {
  const { chain, view } = await searchParams;
  const { gems, dexWatch } = await fetchRadarBundle();
  const watched = gems.filter((g) => g.kolCount + g.smartCount > 0);
  const base = view === "all" ? [...gems, ...dexWatch] : view === "dex" ? dexWatch : watched.length ? watched : gems;
  const rows = chain ? base.filter((g) => g.chain === chain) : base;

  return (
    <Shell
      title="Gem radar"
      subtitle="Varsayılan: en az bir KOL veya smart cüzdan almış RH tokenlar. Dex izleme ayrı — FOMO handle yoksa öne çıkmaz."
    >
      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {[
          ["smart küme", "/gems"],
          ["tüm RH", "/gems?view=all&chain=robinhood"],
          ["sol/base izleme", "/gems?view=dex"],
        ].map(([label, href]) => (
          <a key={href} href={href} className="rounded-md border border-line px-3 py-1 text-mute hover:text-ink">
            {label}
          </a>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((g) => (
          <GemCard key={g.id} gem={g} />
        ))}
      </div>
    </Shell>
  );
}
