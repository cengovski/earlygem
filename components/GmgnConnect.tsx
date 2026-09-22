"use client";

import { useEffect, useState } from "react";
import { gmgnSniffSource } from "@/lib/gmgn-sniff";

const LOG_KEY = "eg_connect_log";
const OK_KEY = "eg_connect_ok";
const GMGN = "https://gmgn.ai/follow";

function loadLog(): string[] {
  try {
    const raw = JSON.parse(sessionStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(raw) ? raw.map(String).slice(-80) : [];
  } catch {
    return [];
  }
}

function errText(err: unknown) {
  const raw = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  return raw.replace(/javascript:\S+/g, "javascript:…").slice(0, 180);
}

function copyText(text: string) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.cssText = "position:fixed;left:0;top:0;opacity:0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function GmgnConnect() {
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("hazır");
  const [busy, setBusy] = useState(false);
  const [linked, setLinked] = useState(false);
  const [sniff, setSniff] = useState("");

  function markLinked() {
    setLinked(true);
    setStatus("bağlandı");
    try {
      sessionStorage.setItem(OK_KEY, "1");
    } catch {
      /* private mode */
    }
  }

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
    try {
      if (sessionStorage.getItem(OK_KEY) === "1") {
        setLinked(true);
        setStatus("bağlandı");
      }
    } catch {
      /* private mode */
    }
    const onLog = (ev: Event) => {
      const line = String((ev as CustomEvent<string>).detail || "");
      if (!line) return;
      push(line);
      if (/v5\.6 takildi|v5\.6 follow attach/.test(line)) markLinked();
      else if (/TRACK batch|havuz \+/.test(line)) setStatus((prev) => (prev === "bağlandı" ? prev : "canlı"));
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
    const code = gmgnSniffSource(window.location.origin);
    setSniff(code);
    const copied = copyText(code);
    push(copied ? "v5.6 panoya yazıldı" : "pano yazılamadı — alttaki kod kutusundan kopyala");
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
          (win as Window & { eval: (code: string) => unknown }).eval(code);
          push("eval oldu — gmgn.ai/follow enjekte edildi");
          markLinked();
          injected = true;
          break;
        } catch (evalErr) {
          push(`eval reddedildi ${errText(evalErr)}`);
        }
        try {
          win.location.href = `javascript:${encodeURIComponent(code)}`;
          push("javascript: atandı, istisna yok");
        } catch (jsErr) {
          push(`javascript: reddedildi ${errText(jsErr)}`);
        }
        push(
          copied
            ? "v5.6 panoda. gmgn Track’i bir kez yenile, F12 → Console → yapıştır → Enter"
            : "enjeksiyon reddedildi. Kod kutusundan v5.6’yı kopyala, Track’i yenile, console’a yapıştır",
        );
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

  function copyLog() {
    const text = log.join("\n") || "boş log";
    if (copyText(text)) {
      push("log panoya kopyalandı");
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => push("log panoya kopyalandı"),
      (err) => push(`log kopyalanamadı ${errText(err)}`),
    );
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
        <span className={linked ? "font-mono text-[11px] text-buy" : "font-mono text-[11px] text-mute"}>{status}</span>
        <button type="button" className="rounded-md border border-line px-2 py-1 text-[11px] text-mute" onClick={() => setOpen((v) => !v)}>
          {open ? "logu gizle" : "log"}
        </button>
        <button type="button" className="rounded-md border border-line px-2 py-1 text-[11px] text-mute" onClick={copyLog}>
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
      {linked ? (
        <p className="mt-2 rounded-md border border-buy bg-[#1d3a18]/80 px-3 py-2 text-sm text-buy">
          GMGN follow bağlandı. https://gmgn.ai/follow enjekte edildi, Track alımları bu sekmeye geliyor.
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-mute">
          https://gmgn.ai/follow açar ve v5.6 kodunu enjekte etmeyi dener. Tutarsa burada “bağlandı” yazar. Tarayıcı keserse hata logda kalır; kod panoya düşer, follow sekmesini bir kez yenileyip console’a yapıştır.
        </p>
      )}
      {open ? (
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-md border border-line bg-[#12110c] p-2 font-mono text-[10px] text-ink">
          {log.length ? log.join("\n") : "henüz kayıt yok"}
        </pre>
      ) : null}
      {sniff ? (
        <textarea
          className="mt-2 h-20 w-full rounded-md border border-line bg-[#12110c] p-2 font-mono text-[10px]"
          readOnly
          value={sniff}
          aria-label="v5.6 overlay"
        />
      ) : null}
    </div>
  );
}
