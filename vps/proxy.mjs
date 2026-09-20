#!/usr/bin/env node
/** Tiny pulse + GMGN proxy for the RackNerd box. */
import http from "node:http";

const PORT = Number(process.env.PORT || 8787);
const PULSE = "https://fomopulse.app";
const GMGN = "https://openapi.gmgn.ai";
const KEY = process.env.GMGN_API_KEY || "gmgn_solbscbaseethmonadtron";
const ALLOW = new Set([
  "/api/status",
  "/api/traders",
  "/api/tape",
  "/api/discover",
  "/api/bags",
  "/api/overview",
  "/api/alive",
  "/health",
]);

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, X-APIKEY");
}

function pathOnly(url) {
  const u = new URL(url, "http://local");
  return u.pathname;
}

async function relayPulse(reqUrl) {
  const u = new URL(reqUrl, PULSE);
  const dest = `${PULSE}${u.pathname}${u.search}`;
  const res = await fetch(dest, {
    headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0 earlygem-vps" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  return { status: res.status, body: text, type: res.headers.get("content-type") || "application/json" };
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url || "/";
  const path = pathOnly(url);
  try {
    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ip: "107.175.85.233", pulse: PULSE }));
      return;
    }
    if (path === "/api/gmgn/activity" && req.method === "POST") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
      const traders = Array.isArray(body.traders) ? body.traders.slice(0, 4) : [];
      const rows = [];
      for (const t of traders) {
        const wallet = t.solana || t.address;
        if (!wallet) continue;
        const chain = t.solana ? "sol" : "base";
        const qs = new URLSearchParams({
          chain,
          wallet_address: wallet,
          limit: "12",
          timestamp: String(Math.floor(Date.now() / 1000)),
          client_id: crypto.randomUUID(),
        });
        const g = await fetch(`${GMGN}/v1/user/wallet_activity?${qs}`, {
          headers: { "X-APIKEY": KEY, Accept: "application/json" },
          signal: AbortSignal.timeout(8_000),
        });
        const json = await g.json().catch(() => null);
        const acts = json?.data?.activities || [];
        for (const row of acts) {
          if (row.event_type !== "buy" && row.event_type !== "sell") continue;
          rows.push(row);
        }
        await new Promise((r) => setTimeout(r, 900));
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, count: rows.length, rows }));
      return;
    }
    if (!ALLOW.has(path) && !path.startsWith("/api/")) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    if (!ALLOW.has(path)) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "not_found" }));
      return;
    }
    const out = await relayPulse(url);
    res.writeHead(out.status, { "content-type": out.type });
    res.end(out.body);
  } catch (err) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "upstream", detail: err instanceof Error ? err.message : "fail" }));
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`earlygem-vps proxy :${PORT}`);
});
