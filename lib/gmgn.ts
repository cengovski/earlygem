import type { ChainId, SmartKind, TapeFill, Trader } from "./types";

const HOST = "https://openapi.gmgn.ai";
const DEMO_KEY = "gmgn_solbscbaseethmonadtron";

export function gmgnApiKey() {
  return process.env.GMGN_API_KEY || process.env.NEXT_PUBLIC_GMGN_API_KEY || DEMO_KEY;
}

export function gmgnChain(chain: ChainId): string | null {
  if (chain === "solana") return "sol";
  if (chain === "base") return "base";
  if (chain === "bsc") return "bsc";
  if (chain === "ethereum") return "eth";
  if (chain === "robinhood") return "robinhood";
  if (chain === "monad") return "monad";
  return null;
}

type GmgnToken = { address?: string; symbol?: string; logo?: string; name?: string };
type GmgnActivity = {
  wallet?: string;
  chain?: string;
  tx_hash?: string;
  timestamp?: number;
  event_type?: string;
  token_amount?: string;
  cost_usd?: string | number | null;
  price_usd?: string | number | null;
  token?: GmgnToken;
};
type GmgnEnvelope = { code?: number; data?: { activities?: GmgnActivity[]; list?: GmgnActivity[] } };

async function gmgnGet(path: string, query: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value == null || value === "") continue;
    params.set(key, String(value));
  }
  params.set("timestamp", String(Math.floor(Date.now() / 1000)));
  params.set("client_id", crypto.randomUUID());
  const res = await fetch(`${HOST}${path}?${params.toString()}`, {
    headers: { "X-APIKEY": gmgnApiKey(), Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as GmgnEnvelope;
}

function num(v: string | number | null | undefined) {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fillFromActivity(row: GmgnActivity, trader: Trader): TapeFill | null {
  const side = row.event_type === "sell" ? "sell" : row.event_type === "buy" ? "buy" : null;
  if (!side) return null;
  const token = row.token?.address;
  if (!token) return null;
  const usd = num(row.cost_usd);
  if (usd > 0 && usd < 8) return null;
  const ts = row.timestamp || 0;
  return {
    id: `gmgn-${row.tx_hash || token}-${ts}`,
    ts: ts > 10_000_000_000 ? ts : ts * 1000,
    chain: "solana",
    side,
    usd,
    amount: num(row.token_amount),
    price: num(row.price_usd) || null,
    token,
    symbol: row.token?.symbol || "???",
    name: row.token?.name || row.token?.symbol || "token",
    mcap: null,
    liquidity: null,
    change24: null,
    pairUrl: `https://gmgn.ai/sol/token/${token}`,
    imageUrl: row.token?.logo || null,
    wallet: row.wallet || trader.solana,
    handle: trader.handle,
    followers: trader.followers,
    profileUrl: trader.profileUrl,
    rank: trader.rank,
    tx: row.tx_hash || null,
    firstBuy: false,
    flags: [trader.kind, "gmgn"],
    source: "dexscreener",
    smartKind: trader.kind as SmartKind,
  };
}

export async function fetchGmgnWalletTape(traders: Trader[]): Promise<TapeFill[]> {
  const roster = traders.filter((t) => t.solana).slice(0, 8);
  if (!roster.length) return [];
  const bags = await Promise.all(
    roster.map(async (trader) => {
      const raw = await gmgnGet("/v1/user/wallet_activity", {
        chain: "sol",
        wallet_address: trader.solana!,
        limit: 20,
      });
      const rows = raw?.data?.activities || raw?.data?.list || [];
      return rows.map((row) => fillFromActivity(row, trader)).filter((x): x is TapeFill => Boolean(x));
    }),
  );
  return bags.flat().sort((a, b) => b.ts - a.ts);
}
