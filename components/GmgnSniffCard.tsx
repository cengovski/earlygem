"use client";

import { useState } from "react";
import { GMGN_SNIFF_JS } from "@/lib/gmgn-sniff";
import { ingestGmgnTrackPayload } from "@/lib/gmgn-bridge";

export function GmgnSniffCard() {
  const [hint, setHint] = useState("");
  const [paste, setPaste] = useState("");

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium">GMGN Track köprü (F12)</p>
      <p className="text-[11px] text-mute">
        Canlı Track: gmgn WS following_wallet_activity. Havuz yalnız buy tutar (sell sarı kutuda kalır). Bu sayfadan “gmgn Track aç” ile opener kur → F12 v5.1 yapıştır → YENİLEME. Sarı kutu “radar OK” yazmalı; yazmazsa earlygem bu tarayıcıda açık değil.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => {
            window.name = "earlygem";
            window.open("https://gmgn.ai/follow", "gmgntrack");
            setHint("gmgn Track açıldı — F12 v5.1 yapıştır → YENİLEME — sarı kutu radar OK yazınca buy’lar tape’e düşer");
          }}
        >
          gmgn Track aç
        </button>
        <button
          type="button"
          className="rounded-md border border-line px-3 py-1 text-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(GMGN_SNIFF_JS);
              setHint("F12 v5.1 panoda — gmgn Track console’a yapıştır — YENİLEME — radar OK bekleniyor");
            } catch {
              setHint("kopya yok — aşağıdaki kutudan seç");
            }
          }}
        >
          F12 kodunu kopyala
        </button>
      </div>
      <textarea className="h-28 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[10px]" readOnly value={GMGN_SNIFF_JS} />
      <p className="text-[11px] text-mute">
        Sarı kutu TRACK fill yazar; buy’lar tape’e, sell’ler dump’ta kalır. radar OK gelmezse <span className="font-mono">__egGmgn.dump()</span> JSON’unu aşağı yapıştır.
      </p>
      <textarea
        className="h-20 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[10px]"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder='[{"token":"...","side":"buy",...}] veya dump JSON'
      />
      <button
        type="button"
        className="rounded-md border border-line px-3 py-1 text-sm"
        onClick={() => {
          try {
            const raw = JSON.parse(paste);
            const fills = Array.isArray(raw) ? raw : raw.trades || raw.fills || [];
            const n = ingestGmgnTrackPayload(fills);
            setHint(n ? `${n} fill havuza yazıldı` : "trade yok — dump’ta trades var mı bak");
          } catch {
            setHint("JSON değil");
          }
        }}
      >
        JSON’u havuza yaz
      </button>
      {hint ? <p className="text-xs text-accent">{hint}</p> : null}
    </div>
  );
}
