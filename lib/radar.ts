import { attachRosterFlags, isWrappedBase } from "./alert-msg";
import { KNOWN_WALLETS } from "./known";
import { featuredGems, rankGems } from "./score";
import { attachGmgnSecurity } from "./scan";
import { classifyTrader, isWatchedKind, traderIndex } from "./smart";
import { fetchPulseGems, fetchPulseStatus, fetchPulseTape, fetchPulseTraders } from "./sources";
import { fetchSolWatch } from "./dexwatch";
import { fetchExternalFeeds, mergeTraders } from "./feeds";
import { gmgnCooling } from "./gmgn";
import { logEvent } from "./log";
import { attachSolana } from "./solmap";
import { gemsFromSolTape } from "./soltape";
import { clearSnapshot, lastSnapshot, readSnapshot, writeSnapshot, type RadarBundle, type RadarMeta } from "./store";
import { uniqueFills } from "./tape-key";
import { gemsFromSwaps, isSwapFill } from "./trades";
import type { TapeFill, Trader } from "./types";
import { WINDOW_MS } from "./window";

const FRESH_MS = 15_000;
const STALE_MS = 8 * 60_000;
const TAPE_MAX_AGE_MS = WINDOW_MS;

const KNOWN_SOL = Object.fromEntries(
  Object.entries(KNOWN_WALLETS)
    .filter(([, row]) => row.solana)
    .map(([handle, row]) => [handle, row.solana as string]),
);

function keepFill(row: TapeFill) {
  if (row.side !== "buy") return false;
  if (!row.ts || Date.now() - row.ts > TAPE_MAX_AGE_MS) return false;
  return isSwapFill(row) && !isWrappedBase(row.token, row.symbol, row.name);
}

function seedKnownTraders(): Trader[] {
  return Object.entries(KNOWN_WALLETS).map(([handle, row]) => {
    const tagged = classifyTrader({
      handle,
      followers: handle === "unipcs" || handle === "frankdegods" ? 80_000 : 4_000,
      rank: handle === "unipcs" ? 1 : 20,
      volume: 50_000,
      realized: 0,
      unrealized: 0,
      wins: 0,
      trips: 0,
      fills: 10,
    });
    return {
      handle,
      address: row.evm || "",
      solana: row.solana || null,
      displayName: handle,
      avatarUrl: null,
      followers: tagged.smartScore > 70 ? 80_000 : 4_000,
      clan: null,
      profileUrl: `https://fomo.family/profile/${handle}`,
      fills: 10,
      volume: 50_000,
      realized: 0,
      unrealized: 0,
      wins: 0,
      trips: 0,
      openTokens: 0,
      rank: handle === "unipcs" ? 1 : 20,
      lastTs: Date.now(),
      kind: tagged.kind,
      smartScore: tagged.smartScore,
      smartReasons: ["known_map", ...tagged.reasons],
    };
  });
}

function tradersFromTape(tape: TapeFill[]): Trader[] {
  const byHandle = new Map<string, TapeFill[]>();
  for (const row of tape) {
    if (!row.handle || !keepFill(row)) continue;
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

async function withTimeout<T>(job: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    job.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function fetchRadarBundle(opts?: { force?: boolean }): Promise<RadarBundle & { meta: RadarMeta }> {
  if (!opts?.force) {
    const fresh = readSnapshot(FRESH_MS);
    if (fresh) return { ...fresh.bundle, meta: fresh.meta };
  } else {
    clearSnapshot();
  }

  const errors: string[] = [];
  const [status, tradersRaw, dexWatch] = await Promise.all([
    fetchPulseStatus().catch(() => null),
    fetchPulseTraders().catch(() => [] as Trader[]),
    fetchSolWatch().catch(() => []),
  ]);
  const pulseIndex = traderIndex(tradersRaw);
  const [discoverSeed, tapeRaw] = await Promise.all([
    fetchPulseGems(pulseIndex).catch(() => []),
    fetchPulseTape(280, pulseIndex).catch(() => [] as TapeFill[]),
  ]);

  logEvent({
    level: status || tapeRaw.length ? "info" : "warn",
    event: "source",
    outcome: status || tapeRaw.length ? "ok" : "empty",
    count: tapeRaw.length,
    detail: "pulse",
  });
  logEvent({
    level: dexWatch.length ? "info" : "warn",
    event: "source",
    outcome: dexWatch.length ? "ok" : "empty",
    count: dexWatch.length,
    detail: "dex",
  });

  let traders = attachSolana(tradersRaw, KNOWN_SOL);
  let tradersSource: RadarMeta["tradersSource"] = traders.length ? "pulse" : "none";
  if (!traders.length && tapeRaw.length) {
    traders = attachSolana(tradersFromTape(tapeRaw), KNOWN_SOL);
    tradersSource = traders.length ? "tape" : "none";
  }
  if (!traders.length) {
    traders = seedKnownTraders();
    tradersSource = "none";
    errors.push("traders_seeded_known");
  }

  const index = traderIndex(traders);
  const pulseTape = uniqueFills(
    tapeRaw.filter(keepFill).map((row) => ({
      ...row,
      smartKind: row.smartKind || (row.handle ? index.get(row.handle.toLowerCase())?.kind || null : null),
    })),
  );

  const feeds = await withTimeout(fetchExternalFeeds(), 12_000, { fills: [] as TapeFill[], traders: [] as Trader[] });
  traders = mergeTraders(traders, feeds.traders);
  const solTape = uniqueFills(attachRosterFlags(feeds.fills.filter(keepFill), traders)).sort((a, b) => b.ts - a.ts);
  const tape = uniqueFills(attachRosterFlags(pulseTape, traders));
  const solGems = gemsFromSolTape(solTape);
  if (solTape.length) logEvent({ level: "info", event: "sol_tape", outcome: "ok", count: solTape.length, detail: "gmgn+feeds" });

  const rawGems = rankGems([...gemsFromSwaps(discoverSeed.filter((g) => !g.isStock), tape), ...solGems]);
  const gems = await withTimeout(attachGmgnSecurity(rawGems, gmgnCooling() ? 0 : 1), 8_000, rawGems);
  const featured = featuredGems(gems, 6);
  const merged = uniqueFills([...tape, ...solTape]).sort((a, b) => b.ts - a.ts).slice(0, 400);
  const smartTape = merged.filter((r) => isWatchedKind(r.smartKind)).slice(0, 80);
  const bundle: RadarBundle = { traders, tape: merged, gems, featured, smartTape, dexWatch, status, solTape, solGems };
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
