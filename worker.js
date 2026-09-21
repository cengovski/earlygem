const UPSTREAM = "https://fomopulse.app";
const PUMP = "https://frontend-api-v3.pump.fun/users?offset=0&limit=25&sort=followers";
const ALLOWED = new Set(["/", "/health", "/api/status", "/api/tape", "/api/traders", "/api/discover", "/pump/users"]);

function cors(origin) {
  const allow =
    !origin ||
    /vercel\.app$/.test(origin) ||
    origin === "https://earlygem-live.vercel.app" ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("http://localhost");
  return {
    "access-control-allow-origin": allow ? origin || "*" : "https://earlygem-live.vercel.app",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "accept,content-type,authorization",
    "access-control-max-age": "86400",
  };
}

function browserHeaders() {
  return {
    accept: "application/json",
    "user-agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("origin") || "";
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors(origin) });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ ok: true }, { headers: cors(origin) });
    }

    const secret = env?.APP_SECRET || (typeof APP_SECRET !== "undefined" ? APP_SECRET : "");
    if (secret) {
      const auth = request.headers.get("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return Response.json({ error: "unauthorized" }, { status: 401, headers: cors(origin) });
      }
    }

    if (!ALLOWED.has(url.pathname)) {
      return Response.json({ error: "not_found", path: url.pathname }, { status: 404, headers: cors(origin) });
    }

    const target = url.pathname === "/pump/users" ? PUMP : `${UPSTREAM}${url.pathname}${url.search}`;
    const upstream = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: browserHeaders(),
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "public, max-age=8",
        "x-relay-path": url.pathname,
        "x-relay-status": String(upstream.status),
      },
    });
  },
};
