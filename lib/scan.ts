import { gmgnRequest, gmgnSlug } from "./gmgn";
import type { ChainId, Gem } from "./types";

const CACHE_MS = 15 * 60_000;

type Scan = {
  at: number;
  honeypot: boolean;
  securityOk: boolean;
  launchpad: string;
  sellTax: number;
};

const cache = new Map<string, Scan>();

function keyOf(chain: ChainId, token: string) {
  return `${chain}:${token.toLowerCase()}`;
}

function inferLaunchpad(chain: ChainId, token: string) {
  const t = token.toLowerCase();
  if (t.endsWith("pump")) return "Pump.fun";
  if (t.endsWith("bonk")) return "LetsBonk";
  if (t.endsWith("moon")) return "Moonshot";
  if (chain === "robinhood") return "Uniswap";
  if (chain === "bsc") return "PancakeSwap";
  if (chain === "base") return "Uniswap";
  if (chain === "solana") return "Raydium";
  if (chain === "monad") return "Monad DEX";
  return "DEX";
}

function truthy(v: unknown) {
  return v === true || v === 1 || v === "1" || v === "yes" || v === "true";
}

async function gmgn(path: string, query: Record<string, string>) {
  return gmgnRequest(path, query);
}

async function scanOne(chain: ChainId, token: string): Promise<Scan> {
  const cached = cache.get(keyOf(chain, token));
  if (cached && Date.now() - cached.at < CACHE_MS) return cached;
  const slug = gmgnSlug(chain);
  if (!slug) {
    const fallback = { at: Date.now(), honeypot: false, securityOk: false, launchpad: inferLaunchpad(chain, token), sellTax: 0 };
    return fallback;
  }
  const raw = await gmgn("/v1/token/security", { chain: slug, address: token });
  const data = (raw?.data || {}) as Record<string, unknown>;
  const tax = Number(data.sell_tax || 0);
  const top10 = Number(data.top_10_holder_rate || 0);
  const honeypot = truthy(data.is_honeypot) || data.honeypot === 1;
  const alert = Boolean(data.is_show_alert) && top10 >= 0.9;
  const securityOk = !honeypot && !alert && tax < 0.12 && data.honeypot !== 1;
  let launchpad = inferLaunchpad(chain, token);
  if (chain === "solana" || !launchpad) {
    const info = await gmgn("/v1/token/info", { chain: slug, address: token });
    const row = (info?.data || {}) as Record<string, unknown>;
    const named = String(row.launchpad_platform || row.launchpad || "").trim();
    if (named) launchpad = named === "pump" ? "Pump.fun" : named;
  }
  const scan = { at: Date.now(), honeypot, securityOk, launchpad, sellTax: tax };
  cache.set(keyOf(chain, token), scan);
  return scan;
}

export async function attachGmgnSecurity(gems: Gem[], limit = 6): Promise<Gem[]> {
  const out = [...gems];
  const queue = out.filter((g) => g.token).slice(0, limit);
  for (const gem of queue) {
    try {
      const scan = await scanOne(gem.chain, gem.token);
      gem.honeypot = scan.honeypot;
      gem.securityOk = scan.securityOk && !scan.honeypot;
      gem.launchpad = scan.launchpad;
      gem.sellTax = scan.sellTax;
      if (scan.honeypot) {
        gem.score = 0;
        gem.reasons = ["honeypot", ...gem.reasons].slice(0, 5);
      } else if (gem.securityOk) {
        gem.reasons = [`GMGN güvenli`, ...gem.reasons.filter((r) => r !== "GMGN güvenli")].slice(0, 5);
      }
    } catch {
      gem.securityOk = false;
      gem.launchpad = gem.launchpad || inferLaunchpad(gem.chain, gem.token);
    }
  }
  return out;
}
