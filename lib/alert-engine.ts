import { alertKeyboard, alertMcapSkipReason, formatAlertHtml, isWrappedBase } from "./alert-msg";
import { attachHoneypot } from "./alert-honeypot";
import { hydrateHit } from "./dexmeta";
import { noteLocalHit } from "./hour-client";
import { logEvent } from "./log";
import { sendTelegram, telegramConfigured, telegramSentAgo } from "./telegram";
import { bumpTokenViews } from "./tier";
import type { ChainId, TapeFill } from "./types";
import { DEFAULT_RULE, loadRule, type AlertRule } from "./watch";
import { WINDOW_MS } from "./window";

export type NearRow = {
  key: string;
  chain: ChainId;
  symbol: string;
  token: string;
  usd: number;
  buys: number;
  handles: string[];
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
    if (isWrappedBase(row.token, row.symbol, row.name)) continue;
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
    bag.set(key, prev);
  }
  return [...bag.values()]
    .filter((row) => row.buys >= 2 || row.usd >= rule.minUsd * 0.35)
    .sort((a, b) => b.usd / rule.minUsd + b.buys / rule.minBuys - (a.usd / rule.minUsd + a.buys / rule.minBuys))
    .slice(0, 12);
}

function readyRows(rows: NearRow[], rule: AlertRule) {
  return rows.filter((row) => row.usd >= rule.minUsd && row.buys >= rule.minBuys && row.handles.length >= 2);
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
      views: tier.views,
      mcap: row.mcapLast,
    });
    const mcap = hit.mcap || row.mcapLast;
    const mcapSkip = alertMcapSkipReason(mcap);
    if (mcapSkip) {
      setStatus(row.key, mcapSkip);
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
