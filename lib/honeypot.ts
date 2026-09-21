import { loadClientKeys } from "./client-keys";
import { logHttpFailure } from "./log";
import type { ChainId } from "./types";

export type HoneypotScan = {
  honeypot: boolean | null;
  sources: string[];
  reasons: string[];
};

const CACHE_MS = 8 * 60_000;
const cache = new Map<string, { at: number; scan: HoneypotScan }>();

const GOPLUS_EVM: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  bsc: 56,
  base: 8453,
  robinhood: 4663,
  monad: 143,
};

const HONEYPOT_IS_CHAIN: Partial<Record<ChainId, number>> = {
  ethereum: 1,
  bsc: 56,
  base: 8453,
};

function on(v: unknown): boolean {
  if (v && typeof v === "object" && "status" in (v as object)) return on((v as { status: unknown }).status);
  return v === true || v === 1 || v === "1" || v === "true" || v === "yes";
}

function goplusHeaders(): Record<string, string> {
  const key = loadClientKeys().goplus || process.env.GOPLUS_API_KEY || "";
  const h: Record<string, string> = { Accept: "application/json" };
  if (key) h.Authorization = key.startsWith("Bearer ") ? key : `Bearer ${key}`;
  return h;
}

function honeypotIsHeaders(): Record<string, string> {
  const key = loadClientKeys().honeypotis || process.env.HONEYPOTIS_API_KEY || "";
  const h: Record<string, string> = { Accept: "application/json" };
  if (key) h["X-API-KEY"] = key;
  return h;
}

async function getJson(url: string, headers: Record<string, string>, source: string) {
  try {
    const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(7_000) });
    if (!res.ok) {
      if (res.status >= 500 || res.status === 429) {
        logHttpFailure({ url, event: "honeypot", source, status: res.status, detail: res.statusText });
      }
      return null;
    }
    return (await res.json()) as Record<string, unknown>;
  } catch (err) {
    logHttpFailure({ url, event: "honeypot", source, err });
    return null;
  }
}

async function fromGoPlusEvm(chain: ChainId, token: string): Promise<{ honeypot: boolean; reasons: string[] } | null> {
  const cid = GOPLUS_EVM[chain];
  if (!cid) return null;
  const json = await getJson(
    `https://api.gopluslabs.io/api/v1/token_security/${cid}?contract_addresses=${encodeURIComponent(token)}`,
    goplusHeaders(),
    "goplus",
  );
  const bag = (json?.result || {}) as Record<string, Record<string, unknown>>;
  const row = bag[token.toLowerCase()] || bag[Object.keys(bag)[0] || ""];
  if (!row) return null;
  const reasons: string[] = [];
  if (on(row.is_honeypot)) reasons.push("is_honeypot");
  if (on(row.cannot_sell_all)) reasons.push("cannot_sell_all");
  const tax = Number(row.sell_tax || 0);
  if (Number.isFinite(tax) && tax >= 0.49) reasons.push(`sell_tax ${(tax * 100).toFixed(0)}%`);
  return { honeypot: reasons.length > 0, reasons };
}

async function fromGoPlusSol(token: string): Promise<{ honeypot: boolean; reasons: string[] } | null> {
  const json = await getJson(
    `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${encodeURIComponent(token)}`,
    goplusHeaders(),
    "goplus",
  );
  const bag = (json?.result || {}) as Record<string, Record<string, unknown>>;
  const row = bag[token] || bag[Object.keys(bag)[0] || ""];
  if (!row) return null;
  const reasons: string[] = [];
  if (on(row.non_transferable)) reasons.push("non_transferable");
  if (on(row.freezable)) reasons.push("freeze_authority");
  const hooks = row.transfer_hook;
  if (Array.isArray(hooks) && hooks.length) reasons.push("transfer_hook");
  const fee = row.transfer_fee as { status?: unknown } | undefined;
  if (fee && on(fee.status)) reasons.push("transfer_fee");
  return { honeypot: reasons.length > 0, reasons };
}

async function fromHoneypotIs(chain: ChainId, token: string): Promise<{ honeypot: boolean; reasons: string[] } | null> {
  const cid = HONEYPOT_IS_CHAIN[chain];
  if (!cid) return null;
  const json = await getJson(
    `https://api.honeypot.is/v2/IsHoneypot?address=${encodeURIComponent(token)}&chainID=${cid}`,
    honeypotIsHeaders(),
    "honeypot.is",
  );
  if (!json) return null;
  const hp = (json.honeypotResult as { isHoneypot?: boolean } | undefined)?.isHoneypot;
  if (typeof hp !== "boolean") return null;
  const tax = Number((json.simulationResult as { sellTax?: number } | undefined)?.sellTax || 0);
  const reasons: string[] = [];
  if (hp) reasons.push("simulation");
  if (tax >= 49) reasons.push(`sell_tax ${tax.toFixed(0)}%`);
  return { honeypot: reasons.length > 0, reasons };
}

async function fromRugcheck(token: string): Promise<{ honeypot: boolean; reasons: string[] } | null> {
  const json = await getJson(
    `https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(token)}/report/summary`,
    { Accept: "application/json" },
    "rugcheck",
  );
  if (!json) return null;
  const risks = Array.isArray(json.risks) ? (json.risks as Array<{ name?: string; level?: string }>) : [];
  const reasons: string[] = [];
  for (const risk of risks) {
    const name = `${risk.name || ""} ${risk.level || ""}`.toLowerCase();
    if (/(freeze|honeypot|rugged|scam|transfer.*block|mutable.*fee)/.test(name) && /danger|critical|warn|high/.test(name + (risk.level || ""))) {
      reasons.push(risk.name || "rugcheck");
    } else if ((risk.level || "").toLowerCase() === "danger" || (risk.level || "").toLowerCase() === "critical") {
      reasons.push(risk.name || "danger");
    }
  }
  return { honeypot: reasons.length > 0, reasons };
}

export async function scanHoneypotDirect(chain: ChainId, token: string): Promise<HoneypotScan> {
  const k = `${chain}:${token.toLowerCase()}`;
  const hit = cache.get(k);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.scan;

  const jobs: Array<Promise<{ name: string; row: { honeypot: boolean; reasons: string[] } | null }>> = [];
  if (chain === "solana") {
    jobs.push(fromGoPlusSol(token).then((row) => ({ name: "GoPlus", row })));
    jobs.push(fromRugcheck(token).then((row) => ({ name: "RugCheck", row })));
  } else {
    jobs.push(fromGoPlusEvm(chain, token).then((row) => ({ name: "GoPlus", row })));
    jobs.push(fromHoneypotIs(chain, token).then((row) => ({ name: "Honeypot.is", row })));
  }
  const rows = await Promise.all(jobs);
  const sources: string[] = [];
  const reasons: string[] = [];
  let yes = 0;
  let no = 0;
  for (const item of rows) {
    if (!item.row) continue;
    sources.push(item.name);
    if (item.row.honeypot) {
      yes += 1;
      reasons.push(...item.row.reasons.map((r) => `${item.name}: ${r}`));
    } else no += 1;
  }
  const scan: HoneypotScan = {
    honeypot: yes > 0 ? true : no > 0 ? false : null,
    sources,
    reasons,
  };
  cache.set(k, { at: Date.now(), scan });
  return scan;
}

export async function scanHoneypot(chain: ChainId, token: string): Promise<HoneypotScan> {
  if (typeof window !== "undefined") {
    try {
      const res = await fetch(`/api/honeypot?chain=${encodeURIComponent(chain)}&token=${encodeURIComponent(token)}`, {
        cache: "no-store",
      });
      if (res.ok) return (await res.json()) as HoneypotScan;
    } catch {
      /* fall through */
    }
  }
  return scanHoneypotDirect(chain, token);
}

export function honeypotTelegramLine(scan: HoneypotScan) {
  const why = scan.reasons
    .slice(0, 3)
    .join(" · ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  if (scan.honeypot === true) {
    return `🔴 <b>HONEYPOT</b>${why ? ` · ${why}` : ""}`;
  }
  if (scan.honeypot === false) {
    const src = scan.sources.join(" · ");
    return `🟢 <b>HONEYPOT PASSED</b>${src ? ` · ${src}` : ""}`;
  }
  return "⚪ <b>HONEYPOT ?</b> · tarama yok";
}
