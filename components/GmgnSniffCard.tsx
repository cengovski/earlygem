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
        Canlı Track: gmgn WS kanalı following_wallet_activity (s/a/au/h). OpenAPI follow_wallet kapalı. earlygem açık kalsın → Track sekmesinde F12 v5’i yapıştır → sayfayı YENİLEME → sarı kutu TRACK fill yazınca radar dolar. Kodu sohbete yapıştırma.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => {
            window.name = "earlygem";
            window.open("https://gmgn.ai/follow", "gmgntrack");
            setHint("gmgn Track açıldı — F12 Console → v5 kodunu yapıştır → YENİLEME — sarı kutu TRACK fill yazınca radar dolar");
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
              setHint("F12 v5 panoda — gmgn Track console’a yapıştır — YENİLEME — TRACK fill bekleniyor");
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
        Fill gelince gmgn’de sarı kutu TRACK yazar ve earlygem havuza düşer. postMessage olmazsa <span className="font-mono">__egGmgn.dump()</span> JSON’unu aşağı yapıştır.
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
