"use client";

import { useState } from "react";
import { GMGN_SNIFF_JS } from "@/lib/gmgn-sniff";
import { ingestGmgnPaste } from "@/lib/gmgn-bridge";

export function GmgnSniffCard() {
  const [hint, setHint] = useState("");
  const [paste, setPaste] = useState("");

  return (
    <div className="space-y-2 rounded-xl border border-line bg-surface p-4">
      <p className="text-sm font-medium">GMGN Track köprü (F12)</p>
      <p className="text-[11px] text-mute">
        gmgn CSP `connect-src` fetch’i keser — relay yok. F12 v5.4 yapıştır (YENİLEME). Buy JSON panoda. Earlygem’e geç, tape’e tıkla (veya panodan al). Sell tape’e girmez. First = ooc:1.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => {
            window.name = "earlygem";
            window.open("https://gmgn.ai/follow", "gmgntrack");
            setHint("gmgn Track açıldı — F12 v5.4 yapıştır → YENİLEME — sarı kutu pano, earlygem tıkla");
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
              setHint("F12 v5.4 panoda — gmgn Track console’a yapıştır — YENİLEME");
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
        Üst kutu F12 kodu — yalnız gmgn console. Alt kutu buy dump JSON. Overlay’i buraya yapıştırma.
      </p>
      <textarea
        className="h-20 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[10px]"
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
        placeholder='buy dump: {"type":"eg-gmgn-track","fills":[...]}  — overlay değil'
      />
      <button
        type="button"
        className="rounded-md border border-line px-3 py-1 text-sm"
        onClick={() => {
          setHint(ingestGmgnPaste(paste).hint);
        }}
      >
        JSON’u havuza yaz
      </button>
      {hint ? <p className="text-xs text-accent">{hint}</p> : null}
    </div>
  );
}
