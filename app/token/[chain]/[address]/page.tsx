"use client";

import { useParams } from "next/navigation";
import { ChainBadge } from "@/components/Badge";
import { GemCard } from "@/components/GemCard";
import { PulseGate } from "@/components/PulseGate";
import { Shell } from "@/components/Shell";
import { TapeTable } from "@/components/TapeTable";
import { TokenLinks } from "@/components/TokenLinks";
import { explorerToken, shortAddr, usd } from "@/lib/format";
import type { ChainId } from "@/lib/types";

const CHAINS: ChainId[] = ["robinhood", "solana", "base", "bsc", "ethereum", "monad"];

export default function TokenPage() {
  const params = useParams<{ chain: string; address: string }>();
  const chain = params.chain;
  const address = params.address;
  if (!CHAINS.includes(chain as ChainId)) {
    return (
      <Shell title="Token">
        <p className="text-sm text-mute">Bilinmeyen zincir.</p>
      </Shell>
    );
  }
  const c = chain as ChainId;
  return (
    <Shell title={shortAddr(address)} subtitle={address}>
      <PulseGate>
        {(bundle) => {
          const gem =
            bundle.gems.find((g) => g.chain === c && g.token.toLowerCase() === address.toLowerCase()) ||
            bundle.dexWatch.find((g) => g.chain === c && g.token.toLowerCase() === address.toLowerCase());
          const rows = bundle.tape.filter((r) => r.token.toLowerCase() === address.toLowerCase());
          return (
            <>
              <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
                <ChainBadge chain={c} />
                <span className="font-mono text-xs text-mute break-all">{address}</span>
                <a className="hover:text-accent" href={explorerToken(c, address)} target="_blank" rel="noreferrer">
                  explorer
                </a>
                {gem ? <span className="num text-mute">mcap {usd(gem.mcap)}</span> : null}
              </div>
              <div className="mb-6">
                <TokenLinks chain={c} address={address} pairUrl={gem?.pairUrl} />
              </div>
              {gem ? (
                <div className="mb-6 max-w-md">
                  <GemCard gem={gem} />
                </div>
              ) : (
                <p className="mb-6 text-sm text-mute">Bu token keşif listesinde yok; tape kesiti aşağıda.</p>
              )}
              <h2 className="mb-3 text-lg font-medium">Bu token tape</h2>
              <TapeTable rows={rows.slice(0, 40)} />
            </>
          );
        }}
      </PulseGate>
    </Shell>
  );
}
