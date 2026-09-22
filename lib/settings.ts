import type { AlertRule } from "./watch";

let cache: AlertRule | null = null;

function envRule(): AlertRule {
  return {
    windowMin: Number(process.env.ALERT_WINDOW_MIN) || 20,
    minUsd: Number(process.env.ALERT_MIN_USD) || 1000,
    minBuys: Number(process.env.ALERT_MIN_BUYS) || 5,
  };
}

function origin() {
  return (process.env.PULSE_ORIGIN || "").replace(/\/$/, "");
}

function secrets() {
  return [...new Set([process.env.APP_SECRET, process.env.CRON_SECRET].filter(Boolean))] as string[];
}

function headers(token?: string, extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { Accept: "application/json", ...(extra || {}) };
  if (token) out.Authorization = `Bearer ${token}`;
  return out;
}

async function vpsFetch(path: string, init?: RequestInit & { extraHeaders?: Record<string, string> }) {
  const host = origin();
  if (!host) return null;
  const keys = secrets();
  if (!keys.length) keys.push("");
  let last: Response | null = null;
  for (const token of keys) {
    try {
      const res = await fetch(`${host}${path}`, {
        ...init,
        headers: headers(token, init?.extraHeaders),
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      last = res;
      if (res.status !== 401) return res;
    } catch {
      /* try next */
    }
  }
  return last;
}

export async function loadSettings(): Promise<AlertRule> {
  if (cache) return cache;
  const res = await vpsFetch("/api/settings");
  if (res?.ok) {
    const row = (await res.json()) as Partial<AlertRule>;
    const next: AlertRule = {
      windowMin: Number(row.windowMin) || envRule().windowMin,
      minUsd: Number(row.minUsd) || envRule().minUsd,
      minBuys: Number(row.minBuys) || envRule().minBuys,
    };
    cache = next;
    return next;
  }
  cache = envRule();
  return cache;
}

export async function saveSettings(rule: AlertRule) {
  const next: AlertRule = {
    windowMin: Math.max(1, Math.min(120, Number(rule.windowMin) || 20)),
    minUsd: Math.max(100, Number(rule.minUsd) || 1000),
    minBuys: Math.max(1, Math.min(50, Number(rule.minBuys) || 5)),
  };
  cache = next;
  if (!origin()) return { ok: true, persisted: "memory", rule: next };
  const res = await vpsFetch("/api/settings", {
    method: "PUT",
    extraHeaders: { "content-type": "application/json" },
    body: JSON.stringify(next),
  });
  if (res?.ok) return { ok: true, persisted: "vps", rule: next };
  return { ok: true, persisted: "memory", rule: next, note: res ? `vps_${res.status}` : "vps_offline" };
}
