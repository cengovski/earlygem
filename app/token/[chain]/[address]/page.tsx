import { notFound } from "next/navigation";
import { ChainBadge } from "@/components/Badge";
import { GemCard } from "@/components/GemCard";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { dexUrl, explorerToken, shortAddr, usd } from "@/lib/format";
import { fetchRadarBundle } from "@/lib/sources";
import type { ChainId } from "@/lib/types";

export const revalidate = 20;
const CHAINS: ChainId[] = ["robinhood", "solana", "base", "bsc", "ethereum"];

export default async function TokenPage({ params }: { params: Promise<{ chain: string; address: string }> }) {
  const { chain, address } = await params;
  if (!CHAINS.includes(chain as ChainId)) notFound();
  const c = chain as ChainId;
  const bundle = await fetchRadarBundle();
  const gem =
    bundle.gems.find((g) => g.chain === c && g.token.toLowerCase() === address.toLowerCase()) ||
    bundle.dexWatch.find((g) => g.chain === c && g.token.toLowerCase() === address.toLowerCase());
  const rows = bundle.tape.filter((r) => r.token.toLowerCase() === address.toLowerCase());
  return (
    <Shell title={gem?.symbol || shortAddr(address)} subtitle={gem?.name || address}>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <ChainBadge chain={c} />
        <span className="font-mono text-xs text-mute break-all">{address}</span>
        <a className="hover:text-accent" href={explorerToken(c, address)} target="_blank" rel="noreferrer">explorer</a>
        <a className="hover:text-accent" href={dexUrl(c, address, gem?.pairUrl)} target="_blank" rel="noreferrer">dexscreener</a>
        {gem ? <span className="num text-mute">mcap {usd(gem.mcap)}</span> : null}
      </div>
      {gem ? (
        <div className="mb-6 max-w-md"><GemCard gem={gem} /></div>
      ) : (
        <p className="mb-6 text-sm text-mute">Bu token keşif listesinde yok; tape kesiti aşağıda.</p>
      )}
      <h2 className="mb-3 text-lg font-medium">Bu token tape</h2>
      <TapeTable rows={rows.slice(0, 40)} />
    </Shell>
  );
}
