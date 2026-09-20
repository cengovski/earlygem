"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { explorerWallet } from "@/lib/format";
import { rememberSol } from "@/lib/solmap";
import { findTrader } from "@/lib/sources";
import type { FindResult } from "@/lib/types";

function FindInner() {
  const params = useSearchParams();
  const q = params.get("q") || "";
  const [query, setQuery] = useState(q);
  const [result, setResult] = useState<FindResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!q) return;
    setBusy(true);
    findTrader(q)
      .then((row) => {
        setResult(row);
        if (row.handle && row.solana) rememberSol(row.handle, row.solana);
      })
      .finally(() => setBusy(false));
  }, [q]);

  return (
    <Shell title="Handle → cüzdan" subtitle="EVM tape adresi pulse’dan. SOL adresi mapping veya Find çözümü. Çözülen SOL, traders sütununa yazılır ve swap izlenir.">
      <form action="/find" className="mb-6 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="q">FOMO handle</label>
        <input id="q" name="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="unipcs veya fomo.family/profile/…" className="w-full rounded-lg border border-line bg-[#16140f] px-3 py-2 text-ink placeholder:text-mute" />
        <button className="rounded-lg bg-accent px-4 py-2 font-medium text-[#16140c]" type="submit">Çöz</button>
      </form>
      {busy ? <p className="text-sm text-mute">arıyorum…</p> : null}
      {!result && !busy ? <p className="text-sm text-mute">Örnek: unipcs, mino, frankdegods</p> : null}
      {result ? (
        <div className="rounded-xl border border-line bg-surface p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold">@{result.handle}</h2>
            <span className="rounded-md border border-line px-2 py-0.5 font-mono text-[11px] uppercase">{result.proven}</span>
            {result.solana ? <span className="rounded-md border border-line px-2 py-0.5 text-[11px] text-accent">SOL tape izlemede</span> : null}
          </div>
          <p className="mt-2 text-sm text-mute">{result.note}</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-mute">EVM / Robinhood tape</dt>
              <dd className="break-all font-mono text-sm">{result.evm ? <a className="hover:text-accent" href={explorerWallet("robinhood", result.evm)} target="_blank" rel="noreferrer">{result.evm}</a> : "unproven"}</dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wider text-mute">SOL tape</dt>
              <dd className="break-all font-mono text-sm">{result.solana ? <a className="hover:text-accent" href={explorerWallet("solana", result.solana)} target="_blank" rel="noreferrer">{result.solana}</a> : "unproven"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </Shell>
  );
}

export default function FindPage() {
  return (
    <Suspense>
      <FindInner />
    </Suspense>
  );
}
