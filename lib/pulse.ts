import { logEvent, logHttpFailure } from "./log";

const WORKER = "https://damp-butterfly-34a4.cengovski.workers.dev";
const DIRECT = "https://fomopulse.app";
const ORIGIN_COOL_MS = 5 * 60_000;

export const PULSE_WORKER = WORKER;

const originCool = new Map<string, number>();

function extraOrigin() {
  const env =
    (typeof process !== "undefined" &&
      (process.env.NEXT_PUBLIC_PULSE_ORIGIN || process.env.PULSE_ORIGIN)) ||
    "";
  return env.replace(/\/$/, "");
}

function origins() {
  const extra = extraOrigin();
  const httpsExtra = extra.startsWith("https://") ? extra : "";
  // fomopulse.app is Cloudflare-challenged and has no CORS. Browser uses the worker.
  if (typeof window !== "undefined") {
    return [...new Set([httpsExtra, WORKER].filter(Boolean))];
  }
  return [...new Set([httpsExtra || extra, DIRECT, WORKER].filter(Boolean))];
}

export const PULSE_ORIGINS = origins();
export const PULSE = PULSE_ORIGINS[0];

function originReady(origin: string) {
  return (originCool.get(origin) || 0) <= Date.now();
}

function coolOrigin(origin: string) {
  originCool.set(origin, Date.now() + ORIGIN_COOL_MS);
}

function originOf(url: string) {
  try {
    return new URL(url, typeof window !== "undefined" ? window.location.origin : "https://local").origin;
  } catch {
    return url;
  }
}

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

export async function getJson<T>(
  url: string,
  init?: RequestInit & { quiet?: boolean },
): Promise<T | null> {
  const started = Date.now();
  const quiet = Boolean(init?.quiet);
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
      coolOrigin(originOf(url));
      if (!quiet) {
        logEvent({
          level: "warn",
          event: "fetch",
          outcome: "denied",
          status: res.status,
          url,
          ms,
          detail: isChallenge(snippet) ? "cf_challenge" : snippet,
        });
      }
      return null;
    }
    const data = (await res.json()) as T;
    const count = Array.isArray(data) ? data.length : 1;
    if (!quiet) {
      logEvent({ level: "info", event: "fetch", outcome: count ? "ok" : "empty", status: res.status, url, ms, count });
    }
    return data;
  } catch (err) {
    coolOrigin(originOf(url));
    if (!quiet) {
      logEvent({
        level: "error",
        event: "fetch",
        outcome: "error",
        url,
        ms: Date.now() - started,
        detail: err instanceof Error ? err.message : "fetch_failed",
      });
    }
    return null;
  }
}

export async function getPulse<T>(pathAndQuery: string): Promise<T | null> {
  const path = pathAndQuery.startsWith("/") ? pathAndQuery : `/${pathAndQuery}`;
  const list = origins().filter(originReady);
  if (!list.length) return null;
  for (let i = 0; i < list.length; i++) {
    const origin = list[i];
    const url = origin.startsWith("/") ? `${origin}${path.replace(/^\/api/, "")}` : `${origin}${path}`;
    const last = i === list.length - 1;
    const data = await getJson<T>(url, { quiet: !last });
    if (data) return data;
  }
  if (!origins().length) {
    logHttpFailure({ event: "pulse", source: "pulse", url: DIRECT + path, detail: "no_pulse_origin" });
  }
  return null;
}
