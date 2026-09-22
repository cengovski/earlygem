"use client";

import { useEffect, useState } from "react";
import { gmgnSniffSource } from "@/lib/gmgn-sniff";

const LOG_KEY = "eg_connect_log";
const GMGN = "https://gmgn.ai/";

function loadLog(): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(String).slice(-80) : [];
  } catch {
    return [];
  }
}

function errText(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`.slice(0, 220);
  return String(err).slice(0, 220);
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function GmgnConnect() {
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("hazır");
  const [busy, setBusy] = useState(false);

  function push(line: string) {
    const row = `${new Date().toISOString().slice(11, 19)} ${line}`;
    setLog((prev) => {
      const next = [...prev, row].slice(-80);
      try {
        sessionStorage.setItem(LOG_KEY, JSON.stringify(next));
      } catch {
        /* private mode */
      }
      return next;
    });
    setOpen(true);
  }

  useEffect(() => {
    setLog(loadLog());
    const onLog = (ev: Event) => {
      const line = (ev as CustomEvent<string>).detail;
      if (!line) return;
      push(String(line));
      if (/TRACK batch|havuz \+/.test(String(line))) setStatus("canlı");
    };
    window.addEventListener("eg-gmgn-log", onLog);
    return () => window.removeEventListener("eg-gmgn-log", onLog);
  }, []);

  async function connect() {
    if (busy) return;
    setBusy(true);
    setOpen(true);
    window.name = "earlygem";
    push("CONNECT");
    const sniff = gmgnSniffSource(window.location.origin);
    let win: Window | null = null;
    try {
      win = window.open(GMGN, "eg-gmgn");
    } catch (err) {
      push(`popup ${errText(err)}`);
    }
    if (!win) {
      push("popup engellendi — bu site için açılır pencereye izin ver");
      setStatus("popup engelli");
      setBusy(false);
      return;
    }
    push(`gmgn sekmesi ${GMGN}`);
    let injected = false;
    for (const wait of [400, 1200, 2500]) {
      await sleep(wait);
      if (win.closed) {
        push("gmgn sekmesi kapandı");
        setStatus("sekme kapalı");
        setBusy(false);
        return;
      }
      let href = "";
      try {
        href = win.location.href;
      } catch (err) {
        push(`çapraz köken (${errText(err)}) — eval deneniyor`);
        try {
          (win as Window & { eval: (code: string) => unknown }).eval(sniff);
          push("eval oldu");
          setStatus("enjekte");
          injected = true;
          break;
        } catch (evalErr) {
          push(`eval reddedildi ${errText(evalErr)}`);
        }
        try {
          win.location.href = `javascript:${encodeURIComponent(sniff)}`;
          push("javascript: atandı, istisna yok");
        } catch (jsErr) {
          push(`javascript: reddedildi ${errText(jsErr)}`);
        }
        try {
          await navigator.clipboard.writeText(sniff);
          push("v5.6 panoda. gmgn Track’i bir kez yenile, F12 → Console → yapıştır → Enter");
        } catch (clipErr) {
          push(`pano kopyalanamadı ${errText(clipErr)}`);
        }
        setStatus("F12 gerekli");
        setBusy(false);
        return;
      }
      push(`gmgn henüz yok, href ${href.slice(0, 100) || "boş"}`);
    }
    if (!injected) {
      push("2.5sn içinde gmgn çapraz köken olmadı");
      setStatus("zaman aşımı");
    }
    setBusy(false);
  }

  async function copyLog() {
    const text = log.join("\n");
    try {
      await navigator.clipboard.writeText(text || "boş log");
      push("log panoya kopyalandı");
    } catch (err) {
      push(`log kopyalanamadı ${errText(err)}`);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-[#16140c] disabled:opacity-60"
          onClick={() => void connect()}
          disabled={busy}
        >
          {busy ? "bağlanıyor" : "CONNECT"}
        </button>
        <span className="font-mono text-[11px] text-mute">{status}</span>
        <button type="button" className="rounded-md border border-line px-2 py-1 text-[11px] text-mute" onClick={() => setOpen((v) => !v)}>
          {open ? "logu gizle" : "log"}
        </button>
        <button type="button" className="rounded-md border border-line px-2 py-1 text-[11px] text-mute" onClick={() => void copyLog()}>
          logu kopyala
        </button>
        <button
          type="button"
          className="rounded-md border border-line px-2 py-1 text-[11px] text-mute"
          onClick={() => {
            setLog([]);
            try {
              sessionStorage.removeItem(LOG_KEY);
            } catch {
              /* ignore */
            }
          }}
        >
          logu sil
        </button>
      </div>
      <p className="mt-2 text-[11px] text-mute">
        gmgn Track sekmesini açar ve v5.6 kodunu enjekte etmeyi dener. Tarayıcı çapraz kökeni keserse hata burada kalır; kod panoya düşer, Track’i bir kez yenileyip console’a yapıştır.
      </p>
      {open ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-[#12110c] p-2 font-mono text-[10px] text-ink">
          {log.length ? log.join("\n") : "henüz kayıt yok"}
        </pre>
      ) : null}
    </div>
  );
}
