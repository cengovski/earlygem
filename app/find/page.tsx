import { Shell } from "@/components/Shell";
import { explorerWallet } from "@/lib/format";
import { findTrader } from "@/lib/sources";

export const revalidate = 15;

export default async function FindPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const result = q ? await findTrader(q) : null;
  return (
    <Shell title="Handle → cuzdan" subtitle="Profil signer bostur. Tape cuzdani + mapping + opsiyonel FOMOAPI_KEY. Tek eslesme yetmezse unproven.">
      <form action="/find" className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="q">FOMO handle</label>
        <input id="q" name="q" defaultValue={q || ""} placeholder="unipcs veya fomo.family/profile/…" className="w-full rounded-lg border border-line bg-[#16140f] px-3 py-2 text-ink placeholder:text-mute" />
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-[#16140c]" type="submit">Coz</button>
      </form>
      {!result ? <p className="text-sm text-mute">Ornek: unipcs, mino, frankdegods</p> : (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">@{result.handle}</h2>
            <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] uppercase">{result.proven}</span>
          </div>
          <p className="mt-2 text-sm text-mute">{result.note}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-mute">EVM / Robinhood</dt>
              <dd className="font-mono text-sm break-all">{result.evm ? <a className="hover:text-accent" href={explorerWallet("robinhood", result.evm)} target="_blank" rel="noreferrer">{result.evm}</a> : "unproven"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-mute">Solana</dt>
              <dd className="font-mono text-sm break-all">{result.solana ? <a className="hover:text-accent" href={explorerWallet("solana", result.solana)} target="_blank" rel="noreferrer">{result.solana}</a> : "unproven"}</dd>
            </div>
          </dl>
        </div>
      )}
    </Shell>
  );
}
