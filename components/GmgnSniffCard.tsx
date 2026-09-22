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
        Canlı Track: XHR /api/v1/dex_trades_polling + QuotationSocketMgr. F12 v4 yalnız bunları parse eder; cüzdan/balance listesini atlar. earlygem açık kalsın → Track zaten açıksa kodu yapıştır → sayfayı YENİLEME → 10 sn bekle → sarı kutudaki JSON’u bu sohbete yapıştır (kodu değil).
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]"
          onClick={() => {
            window.name = "earlygem";
            window.open("https://gmgn.ai/follow", "gmgntrack");
            setHint("gmgn Track açıldı — F12 Console → kodu yapıştır → YENİLEME, 10 sn, sarı kutu JSON’unu sohbete yapıştır");
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
              setHint("F12 kodu panoda — gmgn console’a yapıştır — kodu bana değil, 10 sn sonraki JSON’u gönder");
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
        Polling gelince gmgn’de sarı kutu çıkar, JSON panoda. O JSON’u sohbete veya aşağı yapıştır. Elle: <span className="font-mono">__egGmgn.dump()</span>
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
