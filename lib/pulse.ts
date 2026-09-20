import { logEvent } from "./log";

const WORKER = "https://damp-butterfly-34a4.cengovski.workers.dev";
const DIRECT = "https://fomopulse.app";
const VPS = "http://107.175.85.233:8787";

function extraOrigin() {
  const env =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_PULSE_ORIGIN || process.env.PULSE_ORIGIN)) ||
    "";
  return env.replace(/\/$/, "");
}

function origins() {
  const extra = extraOrigin();
  if (typeof window !== "undefined") {
    return [...new Set(["/api/upstream", extra, DIRECT, WORKER].filter(Boolean))];
  }
  return [...new Set([extra, VPS, DIRECT, WORKER].filter(Boolean))];
}

export const PULSE_ORIGINS = origins();
export const PULSE = PULSE_ORIGINS[0];

function isChallenge(text: string) {
  return /just a moment|cf-browser-verification|attention required/i.test(text);
}

async function readBodySnippet(res: Response): Promise<string> {
  try {
    const text = await res.clone().text();
    return text.replace(/\s+/g, " ").slice(0, 120) || res.statusText;
  } catch {
    return res.statusText;
  }
}

export async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      cache: "no-store",
      headers: { Accept: "application/json", ...(init?.headers || {}) },
      signal: init?.signal ?? AbortSignal.timeout(8_000),
    });
    const ms = Date.now() - started;
    const snippet = await readBodySnippet(res);
    if (!res.ok || isChallenge(snippet)) {
      logEvent({ level: "warn", event: "fetch", outcome: "denied", status: res.status, url, ms, detail: snippet });
      return null;
    }
    const data = (await res.json()) as T;
    const count = Array.isArray(data) ? data.length : 1;
    logEvent({ level: "info", event: "fetch", outcome: count ? "ok" : "empty", status: res.status, url, ms, count });
    return data;
  } catch (err) {
    logEvent({
      level: "error",
      event: "fetch",
      outcome: "error",
      url,
      ms: Date.now() - started,
      detail: err instanceof Error ? err.message : "fetch_failed",
    });
    return null;
  }
}

export async function getPulse<T>(pathAndQuery: string): Promise<T | null> {
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const list = origins();
  for (const origin of list) {
    const url = origin.startsWith("/") ? `${origin}${path.replace(/^\/api/, "")}` : `${origin}${path}`;
    const data = await getJson<T>(url);
    if (data) return data;
  }
  return null;
}
