"use client";

import { useState } from "react";
import { ingestGmgnTrackPayload } from "@/lib/gmgn-bridge";

export function GmgnTrackIngestBar() {
  const [hint, setHint] = useState("");
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState("");

  function ingest(raw: string, emptyMsg: string) {
    const n = ingestGmgnTrackPayload(raw);
    setHint(n ? `${n} buy 20dk havuza yazıldı` : emptyMsg);
    if (n) setPaste("");
    return n;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <span className="text-mute">GMGN Track</span>
      <button
        type="button"
        className="rounded-md border border-line bg-surface px-2 py-0.5 text-ink hover:border-accent"
        onClick={async () => {
          try {
            const text = await navigator.clipboard.readText();
            const n = ingest(text, "panoda buy yok — gmgn sarı kutu JSON bekleniyor");
            if (!n) setOpen(true);
          } catch {
            setOpen(true);
            setHint("pano okunamadı — JSON yapıştır");
          }
        }}
      >
        panodan al
      </button>
      <button
        type="button"
        className="rounded-md border border-line px-2 py-0.5 text-mute hover:text-ink"
        onClick={() => setOpen((v) => !v)}
      >
        yapıştır
      </button>
      {hint ? <span className="text-accent">{hint}</span> : <span className="text-mute">gmgn sarı kutu buy JSON → tape</span>}
      {open ? (
        <div className="flex w-full flex-wrap items-start gap-2">
          <textarea
            className="h-16 min-w-[16rem] flex-1 rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-[10px]"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              if (text && ingest(text, "JSON’da buy yok")) e.preventDefault();
            }}
            placeholder='{"type":"eg-gmgn-track","fills":[...]} veya dump JSON'
          />
          <button
            type="button"
            className="rounded-md bg-accent px-2 py-1 text-[#16140c]"
            onClick={() => ingest(paste, "JSON’da buy yok — dump’ta fills/trades bak")}
          >
            havuza yaz
          </button>
        </div>
      ) : null}
    </div>
  );
}
