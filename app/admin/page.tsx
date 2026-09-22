"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { loadClientKeys, saveClientKeys, type ClientKeys } from "@/lib/client-keys";
import { chainLabel, explorerWallet, shortAddr } from "@/lib/format";
import { loadNansenCache, nansenChainCounts, pullNansenSmart, type NansenCache } from "@/lib/nansen";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";
import { DEFAULT_RULE, loadRule, saveRule, type AlertRule } from "@/lib/watch";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [rule, setRule] = useState<AlertRule>(DEFAULT_RULE);
  const [keys, setKeys] = useState<ClientKeys>({});
  const [msg, setMsg] = useState("");
  const [nansenInfo, setNansenInfo] = useState<NansenCache | null>(null);
  const [nansenBusy, setNansenBusy] = useState(false);

  useEffect(() => {
    setKeys(loadClientKeys());
    setRule(loadRule());
    setNansenInfo(loadNansenCache());
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
      <form
        className="mt-4 max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveClientKeys(keys);
          setMsg("takip listesi bu tarayıcıya yazıldı — GMGN cüzdan turunda döner");
        }}
      >
        <p className="text-sm font-medium">Solana takip listesi</p>
        <p className="text-xs text-mute">
          Elle yapıştırılan cüzdanlar. Nansen resmi API ayrı kartta; scrape yok. GMGN bu listeyi + Nansen çekimini turla takip eder.
        </p>
        <label className="block text-sm">
          cüzdanlar (satır / virgül)
          <textarea
            className="mt-1 h-32 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
            value={keys.watchSol || ""}
            onChange={(e) => setKeys({ ...keys, watchSol: e.target.value })}
            placeholder={"So11anaWalletxxxxx\nAnotherSolWalletxxxxx"}
          />
        </label>
        <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
          listeyi kaydet
        </button>
      </form>
      <form
        className="mt-4 max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveClientKeys(keys);
          setMsg("Nansen key bu tarayıcıya yazıldı — kredi varsa günde 1 çekim");
        }}
      >
        <p className="text-sm font-medium">Nansen API</p>
        <p className="text-xs text-mute">
          Resmi uç: POST /api/v1/smart-money/dex-trades · Solana + Base + Ethereum + BNB + Robinhood · Smart Trader / Fund · 5 kredi / istek (tek çağrı, tüm ağlar). Radar 24 saatte bir çeker; kredi bitince durur. Cüzdanlar kendi ağında GMGN takibine girer.
        </p>
        <label className="block text-sm">
          API key
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
            type="password"
            value={keys.nansen || ""}
            onChange={(e) => setKeys({ ...keys, nansen: e.target.value })}
            placeholder="apikey header"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
            nansen key kaydet
          </button>
          <button
            className="rounded-md border border-line px-3 py-1 text-sm"
            type="button"
            disabled={nansenBusy}
            onClick={async () => {
              saveClientKeys(keys);
              if (!keys.nansen) {
                setMsg("önce Nansen API key yaz");
                return;
              }
              setNansenBusy(true);
              const out = await pullNansenSmart({ force: true });
              setNansenInfo(out.cache);
              setNansenBusy(false);
              if (out.cache?.error) setMsg(`nansen: ${out.cache.error}`);
              else setMsg(`nansen: ${out.cache?.wallets.length || 0} cüzdan · ${nansenChainCounts(out.cache?.wallets || []) || "ağ yok"} · kredi ${out.cache?.creditsRemaining ?? "?"}`);
            }}
          >
            {nansenBusy ? "çekiliyor…" : "şimdi çek"}
          </button>
        </div>
        {nansenInfo ? (
          <div className="space-y-2">
            <p className="text-xs text-mute">
              son: {nansenInfo.wallets.length} cüzdan
              {nansenChainCounts(nansenInfo.wallets) ? ` · ${nansenChainCounts(nansenInfo.wallets)}` : ""}
              {nansenInfo.creditsRemaining ? ` · kalan kredi ${nansenInfo.creditsRemaining}` : ""}
              {nansenInfo.at ? ` · ${new Date(nansenInfo.at).toLocaleString()}` : ""}
              {nansenInfo.error ? ` · ${nansenInfo.error}` : ""}
            </p>
            {nansenInfo.wallets.length ? (
              <div className="max-h-56 overflow-auto rounded-md border border-line">
                <table className="w-full text-left text-[11px]">
                  <thead className="sticky top-0 bg-[#18160f] text-mute">
                    <tr>
                      <th className="px-2 py-1">ağ</th>
                      <th className="px-2 py-1">etiket</th>
                      <th className="px-2 py-1">cüzdan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nansenInfo.wallets.map((row) => (
                      <tr key={`${row.chain}:${row.address}`} className="border-t border-line">
                        <td className="px-2 py-1 text-mute">{chainLabel(row.chain)}</td>
                        <td className="px-2 py-1">{row.handle}</td>
                        <td className="px-2 py-1 font-mono">
                          <a href={explorerWallet(row.chain, row.address)} target="_blank" rel="noreferrer" className="hover:text-accent">
                            {shortAddr(row.address, 6)}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <p className="text-[11px] text-mute">Kayıt: bu tarayıcı localStorage `eg_nansen_smart_v2`. Üstteki Solana takip kutusuna yazılmaz. Roster `/traders`, alımlar `/tape`.</p>
          </div>
        ) : (
          <p className="text-xs text-mute">henüz çekim yok — şimdi çek</p>
        )}
      </form>
      <form
        className="mt-4 max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveClientKeys(keys);
          setMsg("honeypot key’ler bu tarayıcıya yazıldı");
        }}
      >
        <p className="text-sm font-medium">Honeypot API</p>
        <p className="text-xs text-mute">
          GoPlus panosunda APP Name, APP Key, APP Secret görürsün. APP Name yazılmaz (sadece etiket). APP Key ve APP Secret’ı ayrı kutulara yapıştır. Radar SHA-1 imza ile access token alır. Kullandığımız uçlar: Token Security API (EVM, 15 CU) ve Token Security API for Solana (30 CU). Sui, NFT, approval, phishing gerekmez. Honeypot.is key boş kalabilir.
        </p>
        <label className="block text-sm">
          GoPlus APP Key
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
            type="password"
            value={keys.goplus || ""}
            onChange={(e) => setKeys({ ...keys, goplus: e.target.value })}
            placeholder="APP Key — APP Name değil"
          />
        </label>
        <label className="block text-sm">
          GoPlus APP Secret
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
            type="password"
            value={keys.goplusSecret || ""}
            onChange={(e) => setKeys({ ...keys, goplusSecret: e.target.value })}
            placeholder="APP Secret"
          />
        </label>
        <label className="block text-sm">
          Honeypot.is API key
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
            type="password"
            value={keys.honeypotis || ""}
            onChange={(e) => setKeys({ ...keys, honeypotis: e.target.value })}
            placeholder="boş = public, key yoksa da çalışır"
          />
        </label>
        <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
          honeypot key kaydet
        </button>
      </form>
    </Shell>
  );
}
