const UPSTREAM = "https://fomopulse.app";
const ALLOWED = new Set(["/api/status", "/api/tape", "/api/traders", "/api/discover"]);
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function cors() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "accept,content-type",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(request.url);
    if (!ALLOWED.has(url.pathname)) {
      return Response.json({ error: "not_found", path: url.pathname }, { status: 404, headers: cors() });
    }

    const target = `${UPSTREAM}${url.pathname}${url.search}`;
    const upstream = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "application/json",
        "user-agent": BROWSER_UA,
        referer: "https://fomopulse.app/",
      },
      cf: { cacheTtl: 12, cacheEverything: true },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(),
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "public, max-age=8",
        "x-relay-status": String(upstream.status),
        "x-relay-path": url.pathname,
      },
    });
  },
};
