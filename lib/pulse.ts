import { logEvent } from "./log";

export const PULSE_ORIGINS = [
  (process.env.PULSE_ORIGIN || "https://damp-butterfly-34a4.cengovski.workers.dev").replace(/\/$/, ""),
  "https://fomopulse.app",
].filter((origin, i, all) => origin && all.indexOf(origin) === i);

export const PULSE = PULSE_ORIGINS[0];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

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
        "User-Agent": BROWSER_UA,
        Referer: "https://fomopulse.app/",
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
  for (const origin of PULSE_ORIGINS) {
    const data = await getJson<T>(`${origin}${path}`);
    if (data) return data;
  }
  return null;
}
