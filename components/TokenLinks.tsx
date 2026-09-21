import { tokenToolLinks } from "@/lib/links";
import type { ChainId } from "@/lib/types";

export function TokenLinks({
  chain,
  address,
  pairUrl,
}: {
  chain: ChainId;
  address: string;
  pairUrl?: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {tokenToolLinks(chain, address, pairUrl).map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-line px-2 py-0.5 text-[11px] text-mute hover:text-accent"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
