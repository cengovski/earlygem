import { alertKeyboard, alertMcapSkipReason, buyerSource, formatAlertHtml, isWrappedBase, MAX_ALERT_MCAP, rememberBuyer, skipAlertToken, type BuyerSrc } from "./alert-msg";
import { attachHoneypot } from "./alert-honeypot";
import { fetchDexMeta, hydrateHit } from "./dexmeta";
import { noteLocalHit } from "./hour-client";
import { logEvent } from "./log";
import { sendTelegram, telegramConfigured, telegramSentAgo } from "./telegram";
import { bumpTokenViews } from "./tier";
import type { ChainId, TapeFill } from "./types";
import { DEFAULT_RULE, loadRule, type AlertRule } from "./watch";
import { ALERT_MCAP_TTL_MS, WINDOW_MS } from "./window";

export type NearRow = {
  key: string;
  chain: ChainId;
  symbol: string;
  token: string;
  usd: number;
  buys: number;
  handles: string[];
  buyers: Array<{ handle: string; src: BuyerSrc }>;
  mcapFirst: number | null;
  mcapLast: number | null;
};

const inflight = new Set<string>();
const lastNote = new Map<string, number>();
let status: Record<string, string> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const fn of listeners) fn();
}

function setStatus(key: string, label: string) {
  if (status[key] === label) return;
  status = { ...status, [key]: label };
  emit();
}

export function alertStatus() {
  return status;
}

export function onAlertStatus(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

let stickyNear: string[] = [];

function nearScore(row: NearRow, rule: AlertRule) {
  const handles = Math.min(row.handles.length / 2, 2);
  const buys = row.buys / Math.max(rule.minBuys, 1);
  const usdPart = Math.min(row.usd / Math.max(rule.minUsd, 1), 3) * 0.2;
  return handles + buys + usdPart;
}

export function clusterNear(tape: TapeFill[], rule: AlertRule): NearRow[] {
  const since = Date.now() - rule.windowMin * 60_000;
  type Bag = NearRow & {
    firstTs: number;
    lastTs: number;
    firstMcapTs: number;
    lastMcapTs: number;
    seen: Set<string>;
  };
  const bag = new Map<string, Bag>();
  for (const row of tape) {
    if (row.side !== "buy" || row.ts < since) continue;
    if (skipAlertToken(row) || isWrappedBase(row.token, row.symbol, row.name)) continue;
    const key = `${row.chain}:${row.token.toLowerCase()}`;
    const prev =
      bag.get(key) ||
      ({
        key,
        chain: row.chain,
        symbol: row.symbol,
        token: row.token,
        usd: 0,
        buys: 0,
        handles: [],
        buyers: [],
        mcapFirst: null,
        mcapLast: null,
        firstTs: row.ts,
        lastTs: row.ts,
        firstMcapTs: 0,
        lastMcapTs: 0,
        seen: new Set<string>(),
      } as Bag);
    prev.usd += row.usd || 0;
    prev.buys += 1;
    if (row.symbol) prev.symbol = row.symbol;
    if (!prev.firstTs || row.ts < prev.firstTs) prev.firstTs = row.ts;
    if (!prev.lastTs || row.ts > prev.lastTs) prev.lastTs = row.ts;
    if (row.mcap && row.mcap > 0) {
      if (!prev.firstMcapTs || row.ts <= prev.firstMcapTs) {
        prev.firstMcapTs = row.ts;
        prev.mcapFirst = row.mcap;
      }
      if (!prev.lastMcapTs || row.ts >= prev.lastMcapTs) {
        prev.lastMcapTs = row.ts;
        prev.mcapLast = row.mcap;
      }
    }
    const h = (row.handle || "").replace(/^@/, "");
    if (h && !prev.seen.has(h.toLowerCase())) {
      prev.seen.add(h.toLowerCase());
      prev.handles.push(h);
    }
    if (h) prev.buyers = rememberBuyer(prev.buyers, h, buyerSource(row));
    bag.set(key, prev);
  }
  const scored = [...bag.values()]
    .filter((row) => row.handles.length >= 2 && row.buys >= 2)
    .map((row) => ({ row, score: nearScore(row, rule) }))
    .sort((a, b) => b.score - a.score || a.row.key.localeCompare(b.row.key));
  const byKey = new Map(scored.map((s) => [s.row.key, s]));
  const keep = stickyNear.filter((k) => byKey.has(k));
  const incoming = scored.map((s) => s.row.key).filter((k) => !keep.includes(k));
  const next: string[] = [];
  for (const k of keep) {
    if (next.length >= 12) break;
    next.push(k);
  }
  for (const k of incoming) {
    if (next.length < 12) {
      next.push(k);
      continue;
    }
    let worst = next[0];
    for (const id of next) {
      if ((byKey.get(id)?.score || 0) < (byKey.get(worst)?.score || 0)) worst = id;
    }
    if ((byKey.get(k)?.score || 0) > (byKey.get(worst)?.score || 0) + 0.4) {
      next[next.indexOf(worst)] = k;
    }
  }
  stickyNear = next;
  return next.map((k) => {
    const row = byKey.get(k)!.row;
    const { seen: _s, firstTs: _f, lastTs: _l, firstMcapTs: _fm, lastMcapTs: _lm, ...rest } = row;
    return rest;
  });
}

function readyRows(rows: NearRow[], rule: AlertRule) {
  return rows.filter(
    (row) =>
      row.usd >= rule.minUsd &&
      row.buys >= rule.minBuys &&
      row.handles.length >= 2 &&
      (row.mcapLast == null || row.mcapLast <= 0 || row.mcapLast <= MAX_ALERT_MCAP),
  );
}

async function fireOne(row: NearRow, rule: AlertRule) {
  const ago = telegramSentAgo(row.key);
  if (ago != null) {
    setStatus(row.key, "gönderildi");
    return;
  }
  if (inflight.has(row.key)) return;
  inflight.add(row.key);
  try {
    const liveTg = telegramConfigured();
    const tier = bumpTokenViews(row.chain, row.token);
    const hit = await hydrateHit({
      token: row.token,
      chain: row.chain,
      symbol: row.symbol,
      usd: row.usd,
      buys: row.buys,
      windowMin: rule.windowMin,
      handles: row.handles,
      buyers: row.buyers,
      views: tier.views,
      mcap: row.mcapLast,
    });
    const mcap = hit.mcap || row.mcapLast;
    const mcapSkip = alertMcapSkipReason(mcap);
    if (mcapSkip) {
      setStatus(row.key, mcapSkip === "MC < $250k" || mcapSkip === "MC yok" ? `${mcapSkip} · tekrar bakılacak` : mcapSkip);
      return;
    }
    const ready = await attachHoneypot({ ...hit, mcap });
    const notedAt = lastNote.get(row.key) || 0;
    const freshNote = Date.now() - notedAt > WINDOW_MS;
    if (freshNote) lastNote.set(row.key, Date.now());
    noteLocalHit({
      chain: row.chain,
      token: row.token,
      symbol: hit.symbol || row.symbol,
      buys: row.buys,
      usd: row.usd,
      handles: row.handles,
      mcapFirst: row.mcapFirst,
      mcap,
      change24: hit.change24,
      cross: freshNote,
    });
    if (!liveTg) {
      setStatus(row.key, "eşik · telegram key yok");
      return;
    }
    setStatus(row.key, ready.honeypot ? "honeypot" : "gönderiliyor…");
    const out = await sendTelegram(formatAlertHtml(ready), row.key, {
      html: true,
      keyboard: alertKeyboard(ready.chain, ready.token),
    });
    if (!out.ok && !out.skipped) {
      logEvent({
        level: "error",
        event: "telegram",
        outcome: "error",
        source: "telegram",
        detail: out.error || "tg_fail",
        url: "https://api.telegram.org/bot***/sendMessage",
      });
      setStatus(row.key, out.error || "tg hata");
      return;
    }
    setStatus(row.key, "gönderildi" + (ready.honeypot ? " · honeypot" : ""));
  } catch (err) {
    logEvent({
      level: "error",
      event: "telegram",
      outcome: "error",
      source: "telegram",
      detail: err instanceof Error ? err.message : "alert_fail",
    });
    setStatus(row.key, "tg hata");
  } finally {
    inflight.delete(row.key);
  }
}

export async function runAlertPass(tape: TapeFill[]) {
  const rule = loadRule();
  const rows = clusterNear(tape, rule);
  await Promise.all(
    rows.map(async (row) => {
      const meta = await fetchDexMeta(row.chain, row.token, ALERT_MCAP_TTL_MS);
      if (meta?.mcap) {
        if (!row.mcapFirst) row.mcapFirst = meta.mcap;
        row.mcapLast = meta.mcap;
      }
    }),
  );
  const ready = readyRows(rows, rule);
  for (const row of ready) {
    const ago = telegramSentAgo(row.key);
    if (ago != null) setStatus(row.key, "gönderildi");
    else await fireOne(row, rule);
  }
}

export function loadAlertRule() {
  return loadRule() || DEFAULT_RULE;
}
