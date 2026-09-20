import { KNOWN_WALLETS } from "./known";
import { featuredGems, rankGems } from "./score";
import { classifyTrader, isWatchedKind, traderIndex } from "./smart";
import { fetchPulseGems, fetchPulseStatus, fetchPulseTape, fetchPulseTraders } from "./sources";
import { fetchSolWatch } from "./dexwatch";
import { fetchGmgnWalletTape } from "./gmgn";
import { logEvent } from "./log";
import { attachSolana } from "./solmap";
import { fetchSolTape, gemsFromSolTape } from "./soltape";
import { clearSnapshot, lastSnapshot, readSnapshot, writeSnapshot, type RadarBundle, type RadarMeta } from "./store";
import { gemsFromSwaps, isSwapFill } from "./trades";
import type { TapeFill, Trader } from "./types";

const FRESH_MS = 25_000;
const STALE_MS = 8 * 60_000;

const KNOWN_SOL = Object.fromEntries(
  Object.entries(KNOWN_WALLETS)
    .filter(([, row]) => row.solana)
    .map(([handle, row]) => [handle, row.solana as string]),
);

function tradersFromTape(tape: TapeFill[]): Trader[] {
  const byHandle = new Map<string, TapeFill[]>();
  for (const row of tape) {
    if (!row.handle || !isSwapFill(row)) continue;
    const key = row.handle.toLowerCase();
    const bag = byHandle.get(key) || [];
    bag.push(row);
    byHandle.set(key, bag);
  }
  const out: Trader[] = [];
  for (const rows of byHandle.values()) {
    const head = rows[0];
    const volume = rows.reduce((s, r) => s + (r.usd || 0), 0);
    const tagged = classifyTrader({
      handle: head.handle || "",
      followers: head.followers || 0,
      rank: head.rank,
      volume,
      realized: 0,
      unrealized: 0,
      wins: 0,
      trips: 0,
      fills: rows.length,
    });
    out.push({
      handle: head.handle || "",
      address: head.wallet,
      solana: KNOWN_SOL[head.handle?.toLowerCase() || ""] || null,
      displayName: head.handle || "",
      avatarUrl: null,
      followers: head.followers || 0,
      clan: null,
      profileUrl: head.profileUrl || `https://fomo.family/profile/${head.handle}`,
      fills: rows.length,
      volume,
      realized: 0,
      unrealized: 0,
      wins: 0,
      trips: 0,
      openTokens: 0,
      rank: head.rank,
      lastTs: Math.max(...rows.map((r) => r.ts)),
      kind: tagged.kind,
      smartScore: tagged.smartScore,
      smartReasons: tagged.reasons,
    });
  }
  return out.sort((a, b) => b.volume - a.volume);
}

export async function fetchRadarBundle(opts?: { force?: boolean }): Promise<RadarBundle & { meta: RadarMeta }> {
  if (!opts?.force) {
    const fresh = readSnapshot(FRESH_MS);
    if (fresh) return { ...fresh.bundle, meta: fresh.meta };
  } else {
    clearSnapshot();
  }

  const errors: string[] = [];
  const [status, tradersRaw, discoverSeed, tapeRaw, dexWatch] = await Promise.all([
    fetchPulseStatus().catch((e) => {
      errors.push(`status:${e instanceof Error ? e.message : "fail"}`);
      return null;
    }),
    fetchPulseTraders().catch((e) => {
      errors.push(`traders:${e instanceof Error ? e.message : "fail"}`);
      return [] as Trader[];
    }),
    fetchPulseGems().catch((e) => {
      errors.push(`discover:${e instanceof Error ? e.message : "fail"}`);
      return [];
    }),
    fetchPulseTape(280).catch((e) => {
      errors.push(`tape:${e instanceof Error ? e.message : "fail"}`);
      return [] as TapeFill[];
    }),
    fetchSolWatch().catch((e) => {
      errors.push(`dex:${e instanceof Error ? e.message : "fail"}`);
      return [];
    }),
  ]);

  let traders = attachSolana(tradersRaw, KNOWN_SOL);
  let tradersSource: RadarMeta["tradersSource"] = traders.length ? "pulse" : "none";
  if (!traders.length && tapeRaw.length) {
    traders = attachSolana(tradersFromTape(tapeRaw), KNOWN_SOL);
    tradersSource = traders.length ? "tape" : "none";
    logEvent({
      level: "warn",
      event: "traders_fallback",
      outcome: traders.length ? "ok" : "empty",
      count: traders.length,
      detail: "derived_from_tape",
    });
  }
  if (!status) errors.push("pulse_status_null");
  if (!tradersRaw.length) errors.push("pulse_traders_empty");
  if (!tapeRaw.length) errors.push("pulse_tape_empty");
  if (!discoverSeed.length) errors.push("pulse_discover_empty");

  const index = traderIndex(traders);
  const tape = tapeRaw.filter(isSwapFill).map((row) => ({
    ...row,
    smartKind:
      row.smartKind ||
      (row.handle
        ? index.get(row.handle.toLowerCase())?.kind ||
          classifyTrader({
            followers: row.followers || 0,
            rank: row.rank,
            volume: 0,
            realized: 0,
            unrealized: 0,
            wins: 0,
            trips: 0,
            fills: 0,
          }).kind
        : null),
  }));

  const watchedSol = traders.filter((t) => isWatchedKind(t.kind) && t.solana);
  let solTape = await fetchGmgnWalletTape(watchedSol).catch(() => [] as TapeFill[]);
  if (!solTape.length) solTape = await fetchSolTape(watchedSol).catch(() => [] as TapeFill[]);
  const solGems = gemsFromSolTape(solTape);
  if (solTape.length) logEvent({ level: "info", event: "sol_tape", outcome: "ok", count: solTape.length, detail: "gmgn_or_rpc" });
  else if (traders.some((t) => t.solana)) logEvent({ level: "warn", event: "sol_tape", outcome: "empty", detail: "gmgn_rpc_empty" });

  const gems = rankGems(gemsFromSwaps(discoverSeed.filter((g) => !g.isStock), tape));
  const featured = featuredGems(gems, 6);
  const smartTape = [...solTape.filter((r) => isWatchedKind(r.smartKind)), ...tape.filter((r) => isWatchedKind(r.smartKind))].slice(0, 40);
  const bundle: RadarBundle = { traders, tape: [...solTape, ...tape], gems, featured, smartTape, dexWatch, status, solTape, solGems };
  const meta: RadarMeta = {
    fetchedAt: new Date().toISOString(),
    ageMs: 0,
    fromCache: false,
    fallback: false,
    pulseOk: Boolean(status) || tape.length > 0 || gems.length > 0,
    tradersSource,
    errors,
  };
  const usable = tape.length || traders.length || gems.length || dexWatch.length || solTape.length;
  if (!usable) {
    const stale = lastSnapshot();
    if (stale && stale.meta.ageMs < STALE_MS) {
      return { ...stale.bundle, meta: { ...stale.meta, errors: [...errors, "stale_snapshot"] } };
    }
  }
  writeSnapshot(bundle, meta);
  return { ...bundle, meta };
}

export function bustRadarCache() {
  clearSnapshot();
}
