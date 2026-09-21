#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const PORT = Number(process.env.PORT || 8787);
const PULSE = "https://fomopulse.app";
const GMGN = "https://openapi.gmgn.ai";
const KEY = process.env.GMGN_API_KEY || "";
const GATE = process.env.APP_SECRET || "";
const ORIGIN = process.env.APP_ORIGIN || "https://earlygem-live.vercel.app";
const SETTINGS_FILE = process.env.SETTINGS_FILE || "/opt/earlygem-proxy/settings.json";
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
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept, Authorization");
}

function gated(req) {
  if (!GATE) return false;
  const auth = req.headers.authorization || "";
  return auth === `Bearer ${GATE}`;
}

function pathOnly(url) {
  return new URL(url, "http://local").pathname;
}

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
  } catch {
    return { windowMin: 10, minUsd: 1000, minBuys: 5 };
  }
}

function writeSettings(row) {
  const next = {
    windowMin: Math.max(1, Math.min(120, Number(row.windowMin) || 10)),
    minUsd: Math.max(100, Number(row.minUsd) || 1000),
    minBuys: Math.max(1, Math.min(50, Number(row.minBuys) || 5)),
  };
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next));
  return next;
}

async function relayPulse(reqUrl) {
  const u = new URL(reqUrl, PULSE);
  const dest = `${PULSE}${u.pathname}${u.search}`;
  const res = await fetch(dest, {
    headers: { Accept: "application/json", "User-Agent": "earlygem-worker" },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await res.text();
  return { status: res.status, body: text, type: res.headers.get("content-type") || "application/json" };
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }
  const url = req.url || "/";
  const pathName = pathOnly(url);
  try {
    if (pathName === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, settings: fs.existsSync(SETTINGS_FILE) }));
      return;
    }
    if (!gated(req)) {
      res.writeHead(401, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
    if (pathName === "/api/settings" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(readSettings()));
      return;
    }
    if (pathName === "/api/settings" && req.method === "PUT") {
      const body = await readBody(req);
      const next = writeSettings(body);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, ...next }));
      return;
    }
    if (pathName === "/api/gmgn/activity" && req.method === "POST") {
      if (!KEY) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "GMGN_API_KEY missing" }));
        return;
      }
      const body = await readBody(req);
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
    if (!ALLOW.has(pathName)) {
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
