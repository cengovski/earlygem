import { KNOWN_WALLETS } from "./known";
import { featuredGems, rankGems } from "./score";
import { attachGmgnSecurity } from "./scan";
import { classifyTrader, isWatchedKind, traderIndex } from "./smart";
import { fetchPulseGems, fetchPulseStatus, fetchPulseTape, fetchPulseTraders } from "./sources";
import { fetchSolWatch } from "./dexwatch";
import { fetchGmgnWalletTape } from "./gmgn";
import { fetchExternalFeeds, mergeTraders } from "./feeds";
import { logEvent } from "./log";
import { attachSolana } from "./solmap";
import { gemsFromSolTape } from "./soltape";
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

async function withTimeout<T>(job: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    job.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

async function loadGmgnTape(traders: Trader[]): Promise<TapeFill[]> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch("/api/gmgn-activity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ traders }),
        cache: "no-store",
        signal: AbortSignal.timeout(6_000),
      });
      if (res.ok) {
        const json = (await res.json()) as { rows?: TapeFill[] };
        return json.rows || [];
      }
    } catch {
      return [];
    }
  }
  return withTimeout(fetchGmgnWalletTape(traders), 6_000, []);
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
    fetchPulseStatus().catch(() => null),
    fetchPulseTraders().catch(() => [] as Trader[]),
    fetchPulseGems().catch(() => []),
    fetchPulseTape(280).catch(() => [] as TapeFill[]),
    fetchSolWatch().catch(() => []),
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
  const tape = tapeRaw.filter(isSwapFill).map((row) => ({
    ...row,
    smartKind:
      row.smartKind ||
      (row.handle ? index.get(row.handle.toLowerCase())?.kind || null : null),
  }));

  const watched = traders.filter((t) => isWatchedKind(t.kind) || t.solana);
  const [solTapeRaw, feeds] = await Promise.all([
    withTimeout(loadGmgnTape(watched), 7_000, [] as TapeFill[]),
    withTimeout(fetchExternalFeeds(), 9_000, { fills: [] as TapeFill[], traders: [] as Trader[] }),
  ]);
  traders = mergeTraders(traders, feeds.traders);
  const solTape = [...feeds.fills, ...solTapeRaw].sort((a, b) => b.ts - a.ts);
  const solGems = gemsFromSolTape(solTape);
  if (solTape.length) logEvent({ level: "info", event: "sol_tape", outcome: "ok", count: solTape.length, detail: "gmgn+feeds" });

  const rawGems = rankGems([...gemsFromSwaps(discoverSeed.filter((g) => !g.isStock), tape), ...solGems]);
  const gems = await withTimeout(attachGmgnSecurity(rawGems, 16), 10_000, rawGems);
  const featured = featuredGems(gems, 6);
  const merged = [...solTape, ...tape].sort((a, b) => b.ts - a.ts).slice(0, 400);
  const smartTape = merged.filter((r) => isWatchedKind(r.smartKind)).slice(0, 40);
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
