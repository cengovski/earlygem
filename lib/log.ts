export type LogLevel = "info" | "warn" | "error";
export type FaultKind = "connection" | "api" | "timeout" | "cors" | "auth" | "rate";

export type LogEvent = {
  ts: string;
  level: LogLevel;
  event: string;
  outcome: "ok" | "error" | "empty" | "denied";
  kind?: FaultKind;
  source?: string;
  ms?: number;
  status?: number;
  url?: string;
  detail?: string;
  count?: number;
};

const RING: LogEvent[] = [];
const MAX = 80;
const FAULT_MAX = 200;
const FAULT_KEY = "eg_fault_log";
const listeners = new Set<() => void>();
let hydrated = false;

function emit() {
  for (const fn of listeners) fn();
}

export function onLog(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function sanitizeUrl(url?: string) {
  if (!url) return undefined;
  try {
    const u = new URL(url, typeof window !== "undefined" ? window.location.origin : "https://local");
    u.search = "";
    u.hash = "";
    let href = u.toString();
    href = href.replace(/\/bot[^/]+/i, "/bot***");
    return href;
  } catch {
    return url.replace(/\?.*/, "").replace(/\/bot[^/]+/i, "/bot***");
  }
}

export function sourceFromUrl(url?: string) {
  if (!url) return undefined;
  const u = url.toLowerCase();
  if (u.includes("gmgn")) return "gmgn";
  if (u.includes("binance")) return "binance";
  if (u.includes("fomoapi") || u.includes("fomo.family") || u.includes("fomopulse") || u.includes("workers.dev")) return "pulse";
  if (u.includes("telegram")) return "telegram";
  if (u.includes("cabalspy") || u.includes("cabal")) return "cabalspy";
  if (u.includes("madeonsol")) return "madeonsol";
  if (u.includes("solanatracker")) return "soltrack";
  if (u.includes("pump.fun")) return "pumpfun";
  if (u.includes("dexscreener")) return "dex";
  if (u.includes("bitquery")) return "bitquery";
  if (u.includes("axiom")) return "axiom";
  return u.replace(/^https?:\/\//, "").split("/")[0]?.slice(0, 32);
}

function inferKind(row: Pick<LogEvent, "outcome" | "status" | "detail" | "event">): FaultKind | undefined {
  if (row.outcome === "ok" || row.outcome === "empty") return undefined;
  const d = (row.detail || "").toLowerCase();
  if (row.status === 401 || row.status === 403 || /unauthorized|forbidden|invalid.?key|api.?key|401|403/.test(d)) return "auth";
  if (row.status === 429 || /rate.?limit|too many/.test(d)) return "rate";
  if (/timeout|aborted|abort|hang/.test(d)) return "timeout";
  if (/\bcors\b|access-control/.test(d)) return "cors";
  if (/failed to fetch|networkerror|load failed|offline|err_internet|err_name_not_resolved|err_connection/.test(d)) {
    return "connection";
  }
  if (row.status && row.status >= 400) return "api";
  if (row.outcome === "error") return "connection";
  if (row.outcome === "denied") return "api";
  return undefined;
}

export function isFault(row: LogEvent) {
  if (row.event === "source" && row.outcome === "empty") return false;
  return Boolean(row.kind) || row.level === "error" || (row.outcome === "denied" && Boolean(row.status));
}

function loadFaults(): LogEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(FAULT_KEY) || "[]") as LogEvent[];
    return Array.isArray(raw) ? raw.filter((row) => row && row.ts && row.event) : [];
  } catch {
    return [];
  }
}

function saveFaults(rows: LogEvent[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FAULT_KEY, JSON.stringify(rows.slice(0, FAULT_MAX)));
  } catch {
    /* quota */
  }
}

function hydrate() {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;
  const stored = loadFaults();
  if (!stored.length) return;
  const seen = new Set(RING.map((r) => `${r.ts}|${r.event}|${r.url}|${r.detail}`));
  for (const row of stored) {
    const k = `${row.ts}|${row.event}|${row.url}|${row.detail}`;
    if (seen.has(k)) continue;
    RING.push(row);
    seen.add(k);
  }
  RING.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  while (RING.length > MAX) RING.pop();
}

function persistFault(row: LogEvent) {
  if (!isFault(row) || typeof window === "undefined") return;
  const prev = loadFaults();
  const next = [row, ...prev].slice(0, FAULT_MAX);
  saveFaults(next);
}

export function logEvent(entry: Omit<LogEvent, "ts">): LogEvent {
  hydrate();
  const url = sanitizeUrl(entry.url);
  const kind = entry.kind || inferKind(entry);
  const source = entry.source || sourceFromUrl(entry.url) || (entry.event !== "fetch" ? entry.event : undefined);
  const row: LogEvent = { ts: new Date().toISOString(), ...entry, url, kind, source };
  RING.unshift(row);
  if (RING.length > MAX) RING.pop();
  persistFault(row);
  const line = JSON.stringify({
    event: row.event,
    level: row.level,
    kind: row.kind,
    source: row.source,
    outcome: row.outcome,
    ms: row.ms,
    status: row.status,
    count: row.count,
    detail: row.detail,
    url: row.url,
  });
  if (row.level === "error") console.error(line);
  else if (row.level === "warn") console.warn(line);
  else console.log(line);
  emit();
  return row;
}

export function logHttpFailure(opts: {
  url?: string;
  event?: string;
  source?: string;
  status?: number;
  ms?: number;
  err?: unknown;
  detail?: string;
}) {
  const errText = opts.err instanceof Error ? opts.err.message : opts.err ? String(opts.err) : "";
  const detail = [opts.detail, errText].filter(Boolean).join(" ").trim() || undefined;
  const status = opts.status;
  const kind = inferKind({ outcome: status ? "denied" : "error", status, detail, event: opts.event || "fetch" });
  return logEvent({
    level: kind === "rate" || kind === "auth" ? "warn" : "error",
    event: opts.event || "fetch",
    outcome: status ? "denied" : "error",
    source: opts.source,
    status,
    url: opts.url,
    ms: opts.ms,
    detail,
    kind,
  });
}

export function recentLogs(limit = 50): LogEvent[] {
  hydrate();
  return RING.slice(0, limit);
}

export function recentFaults(limit = 80): LogEvent[] {
  hydrate();
  const live = RING.filter(isFault);
  const stored = loadFaults();
  const seen = new Set<string>();
  const out: LogEvent[] = [];
  for (const row of [...live, ...stored]) {
    const k = `${row.ts}|${row.event}|${row.url}|${row.detail}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

export function faultCount() {
  return recentFaults(FAULT_MAX).length;
}

export function clearFaults() {
  saveFaults([]);
  for (let i = RING.length - 1; i >= 0; i--) if (isFault(RING[i])) RING.splice(i, 1);
  emit();
}

function configuredList() {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem("eg_client_keys") || "{}") as Record<string, string>;
    const flags: string[] = [];
    if (raw.gmgn) flags.push("gmgn");
    if (raw.binanceKey && raw.binanceSecret) flags.push("binance");
    if (raw.fomo) flags.push("fomo");
    if (raw.cabalspy) flags.push("cabalspy");
    if (raw.soltrack) flags.push("soltrack");
    if (raw.madeonsol) flags.push("madeonsol");
    if (raw.bitquery) flags.push("bitquery");
    if (raw.telegramBot && raw.telegramChat) flags.push("telegram");
    return flags;
  } catch {
    return [];
  }
}

export function formatFaultReport() {
  const faults = recentFaults(80);
  const page = typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 140) : "";
  const online = typeof navigator !== "undefined" ? String(navigator.onLine) : "?";
  const lines = [
    "earlygem fault report",
    `at ${new Date().toISOString()}`,
    `page ${page}`,
    `online ${online}`,
    `ua ${ua}`,
    `keys ${configuredList().join(",") || "none"}`,
    `faults ${faults.length}`,
    "",
  ];
  if (!faults.length) {
    lines.push("no connection/api faults stored");
    return lines.join("\n");
  }
  for (const row of faults) {
    lines.push(
      [
        row.ts,
        row.kind || row.level,
        row.source || "-",
        row.event,
        row.outcome,
        row.status != null ? `http ${row.status}` : "-",
        row.ms != null ? `${row.ms}ms` : "-",
        row.url || "-",
        row.detail || "",
      ].join(" | "),
    );
  }
  return lines.join("\n");
}

let hooks = false;
export function installBrowserFaultHooks() {
  if (hooks || typeof window === "undefined") return;
  hooks = true;
  hydrate();
  window.addEventListener("offline", () => {
    logEvent({ level: "error", event: "network", outcome: "error", kind: "connection", detail: "offline" });
  });
  window.addEventListener("unhandledrejection", (ev) => {
    const msg = ev.reason instanceof Error ? ev.reason.message : String(ev.reason || "unhandledrejection");
    if (/hydration|cancel/i.test(msg)) return;
    logEvent({
      level: "error",
      event: "unhandled",
      outcome: "error",
      kind: inferKind({ outcome: "error", detail: msg, event: "unhandled" }),
      detail: msg.slice(0, 220),
    });
  });
  window.addEventListener("error", (ev) => {
    const msg = ev.message || "window.error";
    if (/script error|hydration/i.test(msg)) return;
    logEvent({
      level: "error",
      event: "window",
      outcome: "error",
      kind: inferKind({ outcome: "error", detail: msg, event: "window" }),
      detail: msg.slice(0, 220),
    });
  });
}
