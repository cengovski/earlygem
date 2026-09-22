"use client";

import { useMemo, useState } from "react";
import { chainLabel } from "@/lib/format";
import {
  followedWallets,
  followCounts,
  GMGN_IMPORT_MAX,
  gmgnExportJson,
  type FollowedWallet,
} from "@/lib/gmgn-export";

function download(name: string, text: string) {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function GmgnExportCard({ watchSol, nansenAt }: { watchSol?: string; nansenAt?: number }) {
  const [hint, setHint] = useState("");
  const [open, setOpen] = useState(false);
  const wallets = useMemo(() => followedWallets(), [watchSol, nansenAt]);
  const counts = useMemo(() => followCounts(wallets), [wallets]);
  const bulk = useMemo(() => gmgnExportJson(wallets, { withChain: true }), [wallets]);

  async function copyRows(rows: FollowedWallet[], label: string, withChain: boolean) {
    if (!rows.length) {
      setHint("takip listesi boş — Nansen çek veya Solana kutusuna cüzdan yaz");
      return "";
    }
    const json = gmgnExportJson(rows, { withChain });
    const ok = await copyText(json);
    const n = Math.min(rows.length, GMGN_IMPORT_MAX);
    const extra = rows.length > GMGN_IMPORT_MAX ? ` · tavan ${GMGN_IMPORT_MAX}` : "";
    setHint(ok ? `${label}: ${n} cüzdan panoda${extra}` : `${label}: kopya izni yok, json kutusundan al${extra}`);
    return json;
  }

  return (
    <div className="mt-4 max-w-md space-y-3 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium">GMGN bulk export</p>
      <p className="text-xs text-mute">
        Tüm takip kuyruğu: elle Solana listesi + biriken Nansen roster. GMGN OpenAPI follow listesine yazmaz;{" "}
        <a className="text-accent hover:underline" href="https://gmgn.ai/follow" target="_blank" rel="noreferrer">
          gmgn.ai/follow
        </a>{" "}
        bulk import JSON’u yapıştır (ağ başına ayrı daha temiz). En fazla {GMGN_IMPORT_MAX} adres. Tape, API key hesabındaki listeyi `follow_wallet` ile okur.
      </p>
      <p className="text-xs text-mute">
        {wallets.length} cüzdan
        {counts.length ? ` · ${counts.map((c) => `${chainLabel(c.chain)} ${c.n}`).join(" · ")}` : ""}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          type="button"
          onClick={() => copyRows(wallets, "tümü", true)}
        >
          tümünü kopyala
        </button>
        <button
          className="rounded-md border border-line px-3 py-1 text-sm"
          type="button"
          onClick={() => {
            if (!wallets.length) {
              setHint("takip listesi boş");
              return;
            }
            download("earlygem-gmgn-follow.json", bulk);
            setHint(`tümü: ${Math.min(wallets.length, GMGN_IMPORT_MAX)} cüzdan indirildi`);
          }}
        >
          json indir
        </button>
        <a className="rounded-md border border-line px-3 py-1 text-sm" href="https://gmgn.ai/follow" target="_blank" rel="noreferrer">
          gmgn.ai/follow
        </a>
        <button className="rounded-md border border-line px-3 py-1 text-sm" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "json gizle" : "json göster"}
        </button>
      </div>
      {counts.length ? (
        <div className="flex flex-wrap gap-2">
          {counts.map((c) => (
            <button
              key={c.chain}
              className="rounded-md border border-line px-3 py-1 text-sm"
              type="button"
              onClick={async () => {
                const rows = wallets.filter((w) => w.chain === c.chain);
                const json = await copyRows(rows, chainLabel(c.chain), false);
                if (json) download(`earlygem-gmgn-follow-${c.chain}.json`, json);
              }}
            >
              {chainLabel(c.chain)} {c.n}
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <textarea
          className="h-40 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[11px]"
          readOnly
          value={bulk}
        />
      ) : null}
      {hint ? <p className="text-xs text-mute">{hint}</p> : null}
    </div>
  );
}
