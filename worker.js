const UPSTREAM = "https://fomopulse.app";
const ALLOWED = new Set(["/", "/health", "/api/status", "/api/tape", "/api/traders", "/api/discover"]);
const GATE = typeof APP_SECRET !== "undefined" ? APP_SECRET : "";

function cors() {
  return {
    "access-control-allow-origin": "https://earlygem-live.vercel.app",
    "access-control-allow-methods": "GET,OPTIONS",
    "access-control-allow-headers": "accept,content-type,authorization",
    "access-control-max-age": "86400",
  };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors() });
    }

    const url = new URL(request.url);
    if (url.pathname === "/" || url.pathname === "/health") {
      return Response.json({ ok: true }, { headers: cors() });
    }

    const secret = env?.APP_SECRET || GATE;
    if (secret) {
      const auth = request.headers.get("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return Response.json({ error: "unauthorized" }, { status: 401, headers: cors() });
      }
    }

    if (!ALLOWED.has(url.pathname)) {
      return Response.json({ error: "not_found", path: url.pathname }, { status: 404, headers: cors() });
    }

    const target = `${UPSTREAM}${url.pathname}${url.search}`;
    const upstream = await fetch(target, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "application/json",
        "user-agent": "earlygem-worker",
      },
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...cors(),
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "public, max-age=8",
      },
    });
  },
};
