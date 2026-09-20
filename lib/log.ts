export type LogLevel = "info" | "warn" | "error";

export type LogEvent = {
  ts: string;
  level: LogLevel;
  event: string;
  outcome: "ok" | "error" | "empty" | "denied";
  ms?: number;
  status?: number;
  url?: string;
  detail?: string;
  count?: number;
};

const RING: LogEvent[] = [];
const MAX = 80;

export function logEvent(entry: Omit<LogEvent, "ts">): LogEvent {
  const row: LogEvent = { ts: new Date().toISOString(), ...entry };
  RING.unshift(row);
  if (RING.length > MAX) RING.pop();
  const line = JSON.stringify({
    event: row.event,
    level: row.level,
    outcome: row.outcome,
    ms: row.ms,
    status: row.status,
    count: row.count,
    detail: row.detail,
    url: row.url ? row.url.replace(/\?.*/, "") : undefined,
  });
  if (row.level === "error") console.error(line);
  else if (row.level === "warn") console.warn(line);
  else console.log(line);
  return row;
}

export function recentLogs(limit = 50): LogEvent[] {
  return RING.slice(0, limit);
}
