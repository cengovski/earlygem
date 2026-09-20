import { logEvent } from "./log";

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function extraHeaders(url: string): Record<string, string> {
  if (typeof window !== "undefined") return {};
  return {
    "User-Agent": BROWSER_UA,
    Referer: `${originOf(url)}/`,
    Origin: originOf(url),
  };
}

export async function getJson<T>(url: string, init?: RequestInit & { retries?: number }): Promise<T | null> {
  const retries = init?.retries ?? 1;
  let lastDetail = "";
  for (let attempt = 0; attempt <= retries; attempt++) {
    const started = Date.now();
    try {
      const res = await fetch(url, {
        ...init,
        cache: "no-store",
        headers: {
          Accept: "application/json,text/plain,*/*",
          ...extraHeaders(url),
          ...(init?.headers || {}),
        },
        signal: init?.signal ?? AbortSignal.timeout(14_000),
      });
      const ms = Date.now() - started;
      if (res.status === 429 || res.status >= 500) {
        lastDetail = `${res.status} ${res.statusText}`;
        logEvent({
          level: "warn",
          event: "fetch",
          outcome: "denied",
          status: res.status,
          url,
          ms,
          detail: `${lastDetail} attempt=${attempt}`,
        });
        if (attempt < retries) {
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          continue;
        }
        return null;
      }
      if (!res.ok) {
        logEvent({
          level: "warn",
          event: "fetch",
          outcome: "denied",
          status: res.status,
          url,
          ms,
          detail: res.statusText,
        });
        return null;
      }
      const data = (await res.json()) as T;
      const count = Array.isArray(data) ? data.length : data && typeof data === "object" ? 1 : 0;
      logEvent({ level: "info", event: "fetch", outcome: count ? "ok" : "empty", status: res.status, url, ms, count });
      return data;
    } catch (err) {
      lastDetail = err instanceof Error ? err.message : "fetch_failed";
      logEvent({
        level: "error",
        event: "fetch",
        outcome: "error",
        url,
        ms: Date.now() - started,
        detail: `${lastDetail} attempt=${attempt}`,
      });
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      return null;
    }
  }
  logEvent({ level: "error", event: "fetch", outcome: "error", url, detail: lastDetail || "exhausted" });
  return null;
}
