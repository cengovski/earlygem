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
        gmgn COOP opener’ı keser — radar OK gelmez. Canlı Track: F12 v5.2 yapıştır (YENİLEME). Sarı kutu buy JSON’u panoya yazar. Earlygem radar’da «panodan al». Havuz yalnız buy tutar; First = ooc:1.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => {
            window.name = "earlygem";
            window.open("https://gmgn.ai/follow", "gmgntrack");
            setHint("gmgn Track açıldı — F12 v5.2 yapıştır → YENİLEME — sarı kutu «JSON panoda» yazınca radar’da panodan al");
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
              setHint("F12 v5.2 panoda — gmgn Track console’a yapıştır — YENİLEME — JSON panoda bekleniyor");
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
        Sarı kutu TRACK fill + «JSON panoda» yazar. Radar üst şeritte panodan al. Elle dump: <span className="font-mono">__egGmgn.dump()</span>
      </p>
      <textarea
        className="h-20 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[10px]"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder='{"type":"eg-gmgn-track","fills":[...]} veya dump JSON'
      />
      <button
        type="button"
        className="rounded-md border border-line px-3 py-1 text-sm"
        onClick={() => {
          const n = ingestGmgnTrackPayload(paste);
          setHint(n ? `${n} buy havuza yazıldı` : "buy yok — dump’ta fills/trades bak");
        }}
      >
        JSON’u havuza yaz
      </button>
      {hint ? <p className="text-xs text-accent">{hint}</p> : null}
    </div>
  );
}
