"use client";

import { useEffect, useMemo, useState } from "react";
import { GmgnExportCard } from "@/components/GmgnExportCard";
import { Shell } from "@/components/Shell";
import { chainLabel, explorerWallet, shortAddr } from "@/lib/format";
import { absorbStored, harvestWallets, type HarvestReport } from "@/lib/wallet-harvest";
import type { ChainId } from "@/lib/types";
import {
  clearWalletPool,
  noteWallets,
  readWalletPool,
  walletPoolStats,
  type PoolWallet,
} from "@/lib/wallet-pool";
import { isEvmWallet, isSolWallet } from "@/lib/watchlist";

const EVM_PICK: Array<{ id: "" | ChainId; label: string }> = [
  { id: "", label: "ağ yok" },
  { id: "base", label: "Base" },
  { id: "bsc", label: "BSC" },
  { id: "ethereum", label: "Ethereum" },
  { id: "robinhood", label: "Robinhood" },
  { id: "monad", label: "Monad" },
  { id: "arbitrum", label: "Arbitrum" },
  { id: "hyperevm", label: "HyperEVM" },
  { id: "megaeth", label: "MegaETH" },
  { id: "xlayer", label: "X Layer" },
  { id: "stable", label: "Stable" },
  { id: "arc", label: "Arc" },
];

const SHOW = 180;

function chainText(row: PoolWallet) {
  if (row.family === "solana") return "SOL";
  if (!row.chains.length) return "EVM";
  return row.chains.map((c) => chainLabel(c)).join(" ");
}

function walletHref(row: PoolWallet) {
  if (row.family === "solana") return explorerWallet("solana", row.address);
  const chain = row.chains.find((c) => c !== "unknown");
  if (chain) return explorerWallet(chain, row.address);
  return `https://dexscreener.com/search?q=${encodeURIComponent(row.address)}`;
}

export default function WalletsPage() {
  const [rows, setRows] = useState<PoolWallet[]>([]);
  const [q, setQ] = useState("");
  const [family, setFamily] = useState<"all" | "solana" | "evm">("all");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<HarvestReport | null>(null);
  const [hint, setHint] = useState("");
  const [paste, setPaste] = useState("");
  const [evmChain, setEvmChain] = useState<"" | ChainId>("");
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const load = () => setRows(readWalletPool());
    absorbStored();
    load();
    window.addEventListener("eg-wallets", load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener("eg-wallets", load);
      window.removeEventListener("storage", load);
    };
  }, []);

  const stats = useMemo(() => walletPoolStats(rows), [rows]);
  const shown = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (family !== "all" && row.family !== family) return false;
      if (!query) return true;
      return row.address.toLowerCase().includes(query) || row.handle.toLowerCase().includes(query) || row.sources.some((s) => s.includes(query));
    });
  }, [rows, q, family]);

  async function pull() {
    setBusy(true);
    setHint("kaynaklar taranıyor");
    try {
      const out = await harvestWallets();
      setReport(out);
      setRev((n) => n + 1);
      setHint(`havuz ${out.total} · SOL ${out.sol} · EVM ${out.evm} · bu tur +${out.added}`);
    } catch (err) {
      setHint(err instanceof Error ? err.message : "çekim durdu");
    } finally {
      setBusy(false);
    }
  }

  function addPaste() {
    const chain = evmChain || null;
    const seeds = paste
      .split(/[\s,;]+/)
      .map((part) => part.trim())
      .filter((part) => isSolWallet(part) || isEvmWallet(part))
      .map((address) => ({
        address,
        chain: isSolWallet(address) ? ("solana" as const) : chain,
        handle: address.slice(0, 8),
        source: "watch" as const,
      }));
    if (!seeds.length) {
      setHint("yapışan satırda Solana veya 0x adres yok");
      return;
    }
    noteWallets(seeds);
    setPaste("");
    setRev((n) => n + 1);
    setHint(`${seeds.length} adres havuza yazıldı`);
  }

  return (
    <Shell
      title="Cüzdan havuzu"
      subtitle="Pulse, Binance, Nansen, FOMO, pump, Cabalspy, MadeOnSol, Solana Tracker ve tape aynı adresi bir kez tutar. Solana ve EVM ayrıdır. GMGN dosyası en sonda, ağ başına çıkar."
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c] disabled:opacity-60"
          type="button"
          disabled={busy}
          onClick={() => void pull()}
        >
          {busy ? "çekiliyor…" : "şimdi çek"}
        </button>
        <button
          className="rounded-md border border-line px-3 py-1 text-sm"
          type="button"
          onClick={() => {
            if (!rows.length) return;
            if (!window.confirm("Havuzdaki cüzdanlar silinsin mi?")) return;
            clearWalletPool();
            setReport(null);
            setHint("havuz boş");
          }}
        >
          havuzu temizle
        </button>
        <span className="text-xs text-mute">
          {stats.total} cüzdan · SOL {stats.sol} · EVM {stats.evm}
          {stats.chainless ? ` · ağsız EVM ${stats.chainless}` : ""}
        </span>
      </div>
      <p className="mb-4 max-w-3xl text-xs text-mute">
        Radar açıkken tape cüzdanları kendiliğinden birikir. «şimdi çek» ek olarak Binance tahtalarını (BSC, ETH, Base, Solana, Arbitrum, Monad, Robinhood) ve Cabal zincirlerini tarar. Nansen önbelleği tazeyse kredi harcamaz. Aynı 0x Base ve BSC’de görüldüyse havuzda tek satırdır; GMGN her ağ için ayrı dosya ister, o yüzden export’ta iki kez durabilir.
      </p>
      {hint ? <p className="mb-3 text-xs text-mute">{hint}</p> : null}
      {report ? <p className="mb-3 text-xs text-mute">{report.notes.join(" · ")}</p> : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["all", "tümü"],
            ["solana", "Solana"],
            ["evm", "EVM"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-md border px-3 py-1 text-sm ${family === id ? "border-accent text-ink" : "border-line text-mute"}`}
            onClick={() => setFamily(id)}
          >
            {label}
          </button>
        ))}
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-line bg-[#12110c] px-2 py-1 text-sm"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="adres, isim, kaynak"
        />
      </div>

      {shown.length ? (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <thead className="bg-[#18160f] text-xs text-mute">
              <tr>
                <th className="px-3 py-2">cüzdan</th>
                <th className="px-3 py-2">isim</th>
                <th className="px-3 py-2">ağ</th>
                <th className="px-3 py-2">kaynak</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, SHOW).map((row) => (
                <tr key={`${row.family}:${row.address}`} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">
                    <a href={walletHref(row)} target="_blank" rel="noreferrer" className="hover:text-accent">
                      {shortAddr(row.address, 6)}
                    </a>
                  </td>
                  <td className="px-3 py-2">{row.handle}</td>
                  <td className="px-3 py-2 text-xs text-mute">{chainText(row)}</td>
                  <td className="px-3 py-2 text-xs text-mute">{row.primary}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > SHOW ? (
            <p className="px-3 py-2 text-xs text-mute">
              {SHOW} / {shown.length} satır. Aramayı daralt.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface p-4 text-sm text-mute">
          Havuz boş. Radar açıkken alışlar birikir. «şimdi çek» Pulse, Binance, Nansen, FOMO, pump, Cabalspy, MadeOnSol ve Solana Tracker’dan adres toplar. Key’i olmayan kaynak atlanır.
        </div>
      )}

      <form
        className="mt-4 max-w-3xl space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          addPaste();
        }}
      >
        <p className="text-sm font-medium">Elle yapıştır</p>
        <p className="text-xs text-mute">
          Solana satırı Solana kalır. 0x satırı seçtiğin ağa yazılır. Ağ yoksa EVM kovasında durur; Ethereum’a yapıştırılmaz.
        </p>
        <label className="block text-sm">
          EVM satırlarının ağı
          <select
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 text-sm"
            value={evmChain}
            onChange={(e) => setEvmChain(e.target.value as "" | ChainId)}
          >
            {EVM_PICK.map((row) => (
              <option key={row.label} value={row.id}>
                {row.label}
              </option>
            ))}
          </select>
        </label>
        <textarea
          className="h-28 w-full rounded-md border border-line bg-[#12110c] px-2 py-1 font-mono text-xs"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          placeholder={"So11111111111111111111111111111111111111112\n0xabc…"}
        />
        <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
          havuza ekle
        </button>
      </form>

      <GmgnExportCard rev={rev} />
    </Shell>
  );
}
