"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { loadClientKeys, saveClientKeys, type ClientKeys } from "@/lib/client-keys";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { DEFAULT_RULE, loadRule, saveRule, type AlertRule } from "@/lib/watch";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [rule, setRule] = useState<AlertRule>(DEFAULT_RULE);
  const [keys, setKeys] = useState<ClientKeys>({});
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setKeys(loadClientKeys());
    setRule(loadRule());
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then((row: { ok?: boolean }) => {
        if (row.ok) setAuthed(true);
      })
      .catch(() => undefined);
  }, []);

  if (!authed) {
    return (
      <Shell title="Admin" subtitle="Şifre Vercel ADMIN_PASSWORD. Key’ler yalnızca bu tarayıcıda kalır, sunucuya yazılmaz.">
        <form
          className="max-w-sm space-y-3 rounded-xl border border-line bg-surface p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/admin/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password }),
            });
            const json = (await res.json()) as { ok?: boolean; error?: string };
            if (!json.ok) {
              setMsg(json.error || "giriş yok");
              return;
            }
            setAuthed(true);
            setKeys(loadClientKeys());
            setRule(loadRule());
            setMsg("");
          }}
        >
          <label className="block text-sm">
            şifre
            <input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">gir</button>
          {msg ? <p className="text-xs text-mute">{msg}</p> : null}
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Admin" subtitle="Key ve eşik bu tarayıcıda. Feed istekleri senin IP’nden gider. 10 dk havuz tape’e basılır, eşik dolunca alarm çıkar.">
      <form
        className="mb-4 max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveRule(rule);
          setMsg("eşik bu tarayıcıya yazıldı — tape bu pencereyi kullanır");
        }}
      >
        <p className="text-sm font-medium">Alarm eşiği (10 dk havuz)</p>
        <label className="block text-sm">pencere (dk)<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={1} value={rule.windowMin} onChange={(e) => setRule({ ...rule, windowMin: Number(e.target.value) })} /></label>
        <label className="block text-sm">min alım USD<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={100} value={rule.minUsd} onChange={(e) => setRule({ ...rule, minUsd: Number(e.target.value) })} /></label>
        <label className="block text-sm">min alım adedi<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={1} value={rule.minBuys} onChange={(e) => setRule({ ...rule, minBuys: Number(e.target.value) })} /></label>
        <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">eşiği kaydet</button>
      </form>
      <form
        className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveClientKeys(keys);
          setMsg("key’ler bu tarayıcıya yazıldı — radar bir sonraki turda kullanır");
        }}
      >
        <p className="text-sm font-medium">Tarayıcı key’leri</p>
        <p className="text-xs text-mute">Sunucuya gitmez. Key yoksa o kaynak sessiz kalır.</p>
        <label className="block text-sm">GMGN<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.gmgn || ""} onChange={(e) => setKeys({ ...keys, gmgn: e.target.value })} placeholder="gmgn_..." /></label>
        <label className="block text-sm">Binance key<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.binanceKey || ""} onChange={(e) => setKeys({ ...keys, binanceKey: e.target.value })} /></label>
        <label className="block text-sm">Binance secret<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.binanceSecret || ""} onChange={(e) => setKeys({ ...keys, binanceSecret: e.target.value })} /></label>
        <label className="block text-sm">FOMO API<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.fomo || ""} onChange={(e) => setKeys({ ...keys, fomo: e.target.value })} placeholder="fapi_..." /></label>
        <label className="block text-sm">CabalSpy<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.cabalspy || ""} onChange={(e) => setKeys({ ...keys, cabalspy: e.target.value })} /></label>
        <label className="block text-sm">Solana Tracker<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.soltrack || ""} onChange={(e) => setKeys({ ...keys, soltrack: e.target.value })} /></label>
        <label className="block text-sm">MadeOnSol<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.madeonsol || ""} onChange={(e) => setKeys({ ...keys, madeonsol: e.target.value })} placeholder="msk_..." /></label>
        <label className="block text-sm">Bitquery<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.bitquery || ""} onChange={(e) => setKeys({ ...keys, bitquery: e.target.value })} /></label>
        <label className="block text-sm">Telegram bot token<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.telegramBot || ""} onChange={(e) => setKeys({ ...keys, telegramBot: e.target.value })} placeholder="123:AA..." /></label>
        <label className="block text-sm">Telegram chat id<input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs" type="password" value={keys.telegramChat || ""} onChange={(e) => setKeys({ ...keys, telegramChat: e.target.value })} placeholder="-100..." /></label>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">key kaydet</button>
          <button
            className="rounded-md border border-line px-3 py-1 text-sm"
            type="button"
            onClick={async () => {
              saveClientKeys(keys);
              if (!telegramConfigured()) {
                setMsg("bot token ve chat id yaz, sonra tekrar dene");
                return;
              }
              const out = await sendTelegram("<b>earlygem test</b>\nkey bu tarayıcıdan kanalına gitti.", undefined, { html: true });
              setMsg(out.ok ? "test kanalına gitti — tape açıkken eşik dolunca alarm basılır" : out.error || "telegram hata");
            }}
          >
            telegram test
          </button>
          <button className="rounded-md border border-line px-3 py-1 text-sm" type="button" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); setAuthed(false); }}>çık</button>
        </div>
        {msg ? <p className="text-xs text-mute">{msg}</p> : null}
      </form>
    </Shell>
  );
}
