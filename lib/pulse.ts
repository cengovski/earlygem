import { logEvent } from "./log";

const FALLBACK_WORKER = "https://damp-butterfly-34a4.cengovski.workers.dev";

function publicOrigin() {
  const env =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_PULSE_ORIGIN || process.env.PULSE_ORIGIN)) ||
    "";
  return (env || FALLBACK_WORKER).replace(/\/$/, "");
}

export const PULSE_ORIGINS = [publicOrigin()].filter(Boolean);

export const PULSE = PULSE_ORIGINS[0];

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
      headers: {
        Accept: "application/json",
        ...(init?.headers || {}),
      },
      signal: init?.signal ?? AbortSignal.timeout(12_000),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      logEvent({
        level: "warn",
        event: "fetch",
        outcome: "denied",
        status: res.status,
        url,
        ms,
        detail: await readBodySnippet(res),
      });
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
  return getJson<T>(`${PULSE}${path}`);
}
