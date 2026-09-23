import { harvestBinanceWallets } from "./binance";
import { clientExtraKeys, loadClientKeys } from "./client-keys";
import { harvestExtraFeeds } from "./extra-feeds";
import { fetchFomoAlerts, fetchFomoUser, fomoConfigured } from "./fomoapi";
import { nansenCachedTraders, pullNansenSmart } from "./nansen";
import { readPool } from "./pool";
import { PULSE_WORKER } from "./pulse";
import { fetchPulseTape, fetchPulseTraders } from "./sources";
import { classifyTrader, traderIndex } from "./smart";
import type { Trader } from "./types";
import {
  noteKnownWallets,
  noteTapeFills,
  noteTraders,
  noteWallets,
  readWalletPool,
  type WalletSeed,
} from "./wallet-pool";
import { watchTraders } from "./watchlist";

export type HarvestReport = {
  before: number;
  total: number;
  added: number;
  sol: number;
  evm: number;
  notes: string[];
};

function countFamily() {
  const rows = readWalletPool();
  return {
    total: rows.length,
    sol: rows.filter((r) => r.family === "solana").length,
    evm: rows.filter((r) => r.family === "evm").length,
  };
}

/** Tape already in the browser, Nansen cache, pasted Solana list, known handles. No network. */
export function absorbStored(traders?: Trader[]) {
  noteTapeFills(readPool());
  noteTraders(nansenCachedTraders());
  noteTraders(watchTraders());
  noteKnownWallets();
  if (traders?.length) noteTraders(traders);
}

async function pullPumpHarvest(): Promise<Trader[]> {
  const urls = [`${PULSE_WORKER}/pump/users?offset=0&limit=80&sort=followers`, "/api/pump-roster"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
      if (!res.ok) continue;
      const rows = (await res.json()) as Array<{
        username?: string;
        followers?: number;
        canonical_svm_wallet?: string;
        canonical_evm_wallet?: string;
        x_username?: string | null;
      }>;
      if (!Array.isArray(rows) || !rows.length) continue;
      return rows.slice(0, 80).map((row) => {
        const handle = row.x_username || row.username || row.canonical_svm_wallet?.slice(0, 8) || "pump";
        const tagged = classifyTrader({
          handle,
          followers: row.followers || 0,
          rank: null,
          volume: 0,
          realized: 0,
          unrealized: 0,
          wins: 0,
          trips: 0,
          fills: 0,
        });
        return {
          handle,
          address: row.canonical_evm_wallet || null,
          solana: row.canonical_svm_wallet || null,
          displayName: row.username || handle,
          avatarUrl: null,
          followers: row.followers || 0,
          clan: null,
          profileUrl: "",
          fills: 0,
          volume: 0,
          realized: 0,
          unrealized: 0,
          wins: 0,
          trips: 0,
          openTokens: 0,
          rank: null,
          lastTs: null,
          kind: tagged.kind === "noise" ? "smart" : tagged.kind,
          smartScore: Math.max(tagged.smartScore, 55),
          smartReasons: ["src:pumpfun"],
        } satisfies Trader;
      });
    } catch {
      /* next url */
    }
  }
  return [];
}

async function fomoProfiles(fills: Awaited<ReturnType<typeof fetchFomoAlerts>>) {
  const handles: string[] = [];
  const seen = new Set<string>();
  for (const fill of fills) {
    const handle = (fill.handle || "").replace(/^@/, "").trim();
    if (!handle || handle.length <= 2 || seen.has(handle.toLowerCase())) continue;
    seen.add(handle.toLowerCase());
    handles.push(handle);
  }
  const seeds: WalletSeed[] = [];
  let n = 0;
  for (const handle of handles) {
    if (n >= 8) break;
    const user = await fetchFomoUser(handle);
    n += 1;
    if (!user) continue;
    if (user.solana) seeds.push({ address: user.solana, chain: "solana", handle, source: "fomo" });
    if (user.evm) seeds.push({ address: user.evm, chain: null, handle, source: "fomo" });
  }
  if (seeds.length) noteWallets(seeds);
  return n;
}

/**
 * Deeper pull for the wallet pool. Does not call GMGN follow_wallet.
 * Nansen uses the cache when it is fresh.
 */
export async function harvestWallets(): Promise<HarvestReport> {
  const before = countFamily().total;
  const notes: string[] = [];
  absorbStored();
  const keys = clientExtraKeys();

  const [pulse, binance, extra, pump, nansen, fomo] = await Promise.all([
    (async () => {
      const traders = await fetchPulseTraders().catch(() => [] as Trader[]);
      const tape = await fetchPulseTape(120, traderIndex(traders)).catch(() => []);
      return [traders, tape] as const;
    })(),
    harvestBinanceWallets().catch(() => ({ wallets: [], skip: "hata" })),
    harvestExtraFeeds().catch(() => ({ fills: [], traders: [] as Trader[] })),
    pullPumpHarvest().catch(() => [] as Trader[]),
    pullNansenSmart().catch(() => null),
    fomoConfigured() ? fetchFomoAlerts().catch(() => []) : Promise.resolve([]),
  ]);

  const [pulseTraders, pulseTape] = pulse;
  noteTraders(pulseTraders);
  noteTapeFills(pulseTape);
  notes.push(`pulse ${pulseTraders.length + pulseTape.filter((r) => r.wallet).length}`);

  if (binance.skip) notes.push(`binance ${binance.skip}`);
  else {
    noteWallets(
      binance.wallets.map((row) => ({
        address: row.address,
        chain: row.chain,
        handle: row.handle,
        source: "binance" as const,
      })),
    );
    notes.push(`binance ${binance.wallets.length}`);
  }

  noteTapeFills(extra.fills);
  noteTraders(extra.traders);
  const extraBits = [
    keys.cabalspy ? "cabal" : "",
    keys.madeonsol ? "madeon" : "",
    keys.soltrack ? "soltrack" : "",
  ].filter(Boolean);
  notes.push(extraBits.length ? `${extraBits.join("+")} ${extra.traders.length}` : "cabal/madeon/soltrack key yok");

  noteTraders(pump);
  notes.push(`pump ${pump.length}`);

  if (nansen) {
    noteTraders(nansen.traders);
    noteTapeFills(nansen.fills);
    notes.push(loadClientKeys().nansen ? `nansen ${nansen.traders.length}` : "nansen key yok");
  } else notes.push("nansen hata");

  noteTapeFills(fomo);
  if (fomoConfigured()) {
    const profiles = await fomoProfiles(fomo);
    notes.push(`fomo ${fomo.length} · profil ${profiles}`);
  } else notes.push("fomo key yok");

  const after = countFamily();
  return {
    before,
    total: after.total,
    added: Math.max(0, after.total - before),
    sol: after.sol,
    evm: after.evm,
    notes,
  };
}
