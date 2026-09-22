import { tmpdir } from "os";
import { join } from "path";
import { readFileSync, writeFileSync } from "fs";

const FILE = join(tmpdir(), "eg-gmgn-ingest.json");
const MAX = 200;
const WINDOW_MS = 20 * 60_000;

type Row = Record<string, unknown>;

function keyOf(row: Row) {
  return String(row.tx || row.id || "");
}

function load(): Row[] {
  try {
    const raw = JSON.parse(readFileSync(FILE, "utf8")) as { fills?: Row[] };
    return Array.isArray(raw.fills) ? raw.fills : [];
  } catch {
    return [];
  }
}

function save(fills: Row[]) {
  try {
    writeFileSync(FILE, JSON.stringify({ fills, at: Date.now() }));
  } catch {
    /* tmpfs */
  }
}

function prune(rows: Row[]) {
  const since = Date.now() - WINDOW_MS;
  const seen = new Set<string>();
  const out: Row[] = [];
  for (const row of rows) {
    if (String(row.side || "").toLowerCase() !== "buy") continue;
    const k = keyOf(row);
    if (k && seen.has(k)) continue;
    if (k) seen.add(k);
    const ts = Number(row.ts || 0);
    if (ts && ts < since) continue;
    out.push(row);
    if (out.length >= MAX) break;
  }
  return out;
}

export function pushGmgnIngest(rows: Row[]) {
  const stamped = rows.map((row) => ({ ...row, recv: Date.now() }));
  const next = prune([...stamped, ...load()]);
  save(next);
  return next.length;
}

export function listGmgnIngest(since: number) {
  return prune(load()).filter((row) => Number(row.recv || row.ts || 0) > since);
}
