"use client";

import { useState } from "react";
import { saveClientKeys, type ClientKeys } from "@/lib/client-keys";
import { generateGmgnEd25519, gmgnCreateApiUrl } from "@/lib/gmgn-keygen";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function GmgnPemCard({
  keys,
  setKeys,
  onHint,
}: {
  keys: ClientKeys;
  setKeys: (next: ClientKeys) => void;
  onHint: (msg: string) => void;
}) {
  const [pub, setPub] = useState("");
  const [busy, setBusy] = useState(false);
  const createUrl = pub ? gmgnCreateApiUrl(pub) : "";

  return (
    <div className="space-y-2">
      <label className="block text-sm">
        GMGN private key (follow Track)
        <textarea
          className="mt-1 h-24 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[11px]"
          value={keys.gmgnPem || ""}
          onChange={(e) => setKeys({ ...keys, gmgnPem: e.target.value })}
          placeholder={"-----BEGIN PRIVATE KEY-----\nEd25519 PEM — BEGIN/END satırları dahil\n-----END PRIVATE KEY-----"}
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          className="whitespace-nowrap rounded-md border border-line px-3 py-1 text-sm"
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const pair = await generateGmgnEd25519();
              const next = { ...keys, gmgnPem: pair.privatePem };
              setKeys(next);
              saveClientKeys(next);
              setPub(pair.publicPem);
              onHint("Ed25519 üretildi — public’i GMGN formuna yapıştır (BEGIN/END dahil), API key gelince key kaydet");
            } catch (err) {
              onHint(err instanceof Error ? err.message : "Ed25519 bu tarayıcıda yok — Chrome kullan");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "üretiliyor…" : "Ed25519 üret"}
        </button>
        {pub ? (
          <button
            className="whitespace-nowrap rounded-md border border-line px-3 py-1 text-sm"
            type="button"
            onClick={async () => {
              const ok = await copyText(pub);
              onHint(ok ? "public key panoda" : "kopya izni yok — kutudan al");
            }}
          >
            public kopyala
          </button>
        ) : null}
        {createUrl ? (
          <a className="whitespace-nowrap rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" href={createUrl} target="_blank" rel="noreferrer">
            GMGN’de API key oluştur
          </a>
        ) : null}
      </div>
      {pub ? (
        <label className="block text-sm">
          Public key (GMGN’e yapıştır)
          <textarea
            className="mt-1 h-20 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[11px]"
            readOnly
            value={pub}
          />
        </label>
      ) : null}
      <p className="text-[11px] text-mute">
        gmgn.ai/follow sayfası CORS ve cookie yüzünden buradan çekilmez. Aynı Track akışı resmi{" "}
        <span className="font-mono">GET /v1/trade/follow_wallet</span> ile gelir; liste API key’in bağlı olduğu GMGN
        hesabındadır. Public’i{" "}
        <a className="text-accent hover:underline" href="https://gmgn.ai/ai" target="_blank" rel="noreferrer">
          gmgn.ai/ai
        </a>{" "}
        formuna yapıştır (BEGIN/END dahil). Private tarayıcıda kalır, Vercel’e gitmez — yalnız imza header’ı proxy’den
        geçer. PEM yoksa eski 8-cüzdan taraması devam eder. Terminal: <span className="font-mono">npx gmgn-cli config</span>.
      </p>
    </div>
  );
}
