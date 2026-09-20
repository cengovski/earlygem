import type { AlertRule } from "./watch";

let cache: AlertRule | null = null;

function envRule(): AlertRule {
  return {
    windowMin: Number(process.env.ALERT_WINDOW_MIN) || 10,
    minUsd: Number(process.env.ALERT_MIN_USD) || 1000,
    minBuys: Number(process.env.ALERT_MIN_BUYS) || 5,
  };
}

function origin() {
  return (process.env.PULSE_ORIGIN || "").replace(/\/$/, "");
}

function headers(extra?: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = { Accept: "application/json", ...(extra || {}) };
  const s = process.env.APP_SECRET || process.env.CRON_SECRET || "";
  if (s) out.Authorization = `Bearer ${s}`;
  return out;
}

export async function loadSettings(): Promise<AlertRule> {
  if (cache) return cache;
  const host = origin();
  if (host) {
    try {
      const res = await fetch(`${host}/api/settings`, {
        headers: headers(),
        cache: "no-store",
        signal: AbortSignal.timeout(5_000),
      });
      if (res.ok) {
        const row = (await res.json()) as Partial<AlertRule>;
        const next: AlertRule = {
          windowMin: Number(row.windowMin) || envRule().windowMin,
          minUsd: Number(row.minUsd) || envRule().minUsd,
          minBuys: Number(row.minBuys) || envRule().minBuys,
        };
        cache = next;
        return next;
      }
    } catch {
      /* env fallback */
    }
  }
  cache = envRule();
  return cache;
}

export async function saveSettings(rule: AlertRule) {
  const next: AlertRule = {
    windowMin: Math.max(1, Math.min(120, Number(rule.windowMin) || 10)),
    minUsd: Math.max(100, Number(rule.minUsd) || 1000),
    minBuys: Math.max(1, Math.min(50, Number(rule.minBuys) || 5)),
  };
  cache = next;
  const host = origin();
  if (!host) return { ok: true, persisted: "memory", rule: next };
  try {
    const res = await fetch(`${host}/api/settings`, {
      method: "PUT",
      headers: headers({ "content-type": "application/json" }),
      body: JSON.stringify(next),
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) return { ok: true, persisted: "vps", rule: next };
    return { ok: true, persisted: "memory", rule: next, note: `vps_${res.status}` };
  } catch {
    return { ok: true, persisted: "memory", rule: next, note: "vps_offline" };
  }
}
