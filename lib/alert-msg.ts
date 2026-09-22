import { formatTierLine, tierFromViews } from "./tier";
import type { ChainId, TapeFill } from "./types";

export type AlertHit = {
  token: string;
  chain: ChainId;
  symbol: string;
  name?: string;
  usd: number;
  buys: number;
  windowMin?: number;
  mcap?: number | null;
  liquidity?: number | null;
  change24?: number | null;
  handles?: string[];
  buyers?: Array<{ handle: string; src: BuyerSrc }>;
  views?: number;
  honeypot?: boolean | null;
  honeypotLine?: string;
};

const WRAPPED_ADDR = new Set(
  [
    "so11111111111111111111111111111111111111112",
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "0x4200000000000000000000000000000000000006",
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
    "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c",
    "0x2170ed0880ac9a755fd29b2688956bd959f933f8",
    "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f",
    "0x82af49447d8a07e3bd95bd0d56f35241523fbab1",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    "0x0000000000000000000000000000000000000000",
    "pumpcmxqmfrsakq5r49wcjnraryyrqmxz6ae8h7h9dfn",
  ].map((s) => s.toLowerCase()),
);

const WRAPPED_SYM = new Set(
  [
    "WSOL", "WETH", "WBNB", "WBTC", "WBTCb", "BTCB", "WETH.e", "WBTC.e",
    "cbETH", "wstETH", "weETH", "rETH", "WMON", "WAVAX", "WMATIC", "WFTM",
    "WSUI", "WBERA", "SOL", "ETH", "BNB", "BTC", "USDC", "USDT", "USD1",
    "XSOL", "FTT", "ARB", "ZEC", "DOGE", "WIF", "QQQ", "QQQX",
  ].map((s) => s.toUpperCase()),
);

const JUNK_SYM = /^(pump|pumpfun|sol|wsol|usdc|usdt|eth|weth|bnb|wbnb|btc|wbtc|xsol|doge|arb|zec|ftt|ftx|wif|qqq|qqqx|qqy|cards)$/i;
export const MIN_ALERT_MCAP = 250_000;
export const MAX_ALERT_MCAP = 25_000_000;

export function mcapInAlertBand(mcap: number | null | undefined) {
  return typeof mcap === "number" && Number.isFinite(mcap) && mcap >= MIN_ALERT_MCAP && mcap <= MAX_ALERT_MCAP;
}

export function alertMcapSkipReason(mcap: number | null | undefined) {
  if (mcap == null || !Number.isFinite(mcap) || mcap <= 0) return "MC yok";
  if (mcap < MIN_ALERT_MCAP) return "MC < $250k";
  if (mcap > MAX_ALERT_MCAP) return "MC > $25M";
  return null;
}

export function isWrappedBase(token: string, symbol?: string, name?: string) {
  const addr = token.trim().toLowerCase();
  if (WRAPPED_ADDR.has(addr)) return true;
  const sym = (symbol || "").replace(/^\$/, "").trim().toUpperCase();
  if (sym && WRAPPED_SYM.has(sym)) return true;
  if (JUNK_SYM.test(sym)) return true;
  const label = `${sym} ${name || ""}`.toUpperCase();
  if (/\b(WRAPPED|WORMHOLE|XSTOCK|NASDAQ)\b/.test(label)) return true;
  if (/^W(SOL|ETH|BNB|BTC|MON|AVAX|MATIC|FTM|SUI|BERA)$/.test(sym)) return true;
  return false;
}

export function skipAlertToken(row: { token: string; symbol?: string; name?: string; mcap?: number | null }) {
  if (isWrappedBase(row.token, row.symbol, row.name)) return true;
  if (row.mcap != null && row.mcap > 0 && !mcapInAlertBand(row.mcap)) return true;
  return false;
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type BuyerSrc = "KOL" | "SMART" | "NANSEN" | "BINANCE" | "PUMP" | "AXIOM";

const SRC_RANK: Record<BuyerSrc, number> = { NANSEN: 6, AXIOM: 5, PUMP: 4, BINANCE: 3, KOL: 2, SMART: 1 };
const SRC_ORDER: BuyerSrc[] = ["KOL", "SMART", "NANSEN", "BINANCE", "PUMP", "AXIOM"];

export function traderSourceFlags(trader: { kind?: string | null; smartReasons?: string[] }) {
  const tags = new Set<string>();
  if (trader.kind) tags.add(trader.kind.toLowerCase());
  for (const s of trader.smartReasons || []) {
    if (s.startsWith("src:")) tags.add(s.slice(4).toLowerCase());
  }
  return [...tags];
}

function sourceHay(row: { flags?: string[]; smartKind?: string | null; smartReasons?: string[] }) {
  return [
    ...(row.flags || []),
    ...(row.smartReasons || []).map((s) => (s.startsWith("src:") ? s.slice(4) : s)),
    row.smartKind || "",
  ]
    .join(" ")
    .toLowerCase();
}

export function buyerSource(row: { flags?: string[]; smartKind?: string | null; smartReasons?: string[] }): BuyerSrc {
  const h = sourceHay(row);
  if (h.includes("nansen")) return "NANSEN";
  if (h.includes("axiom")) return "AXIOM";
  if (h.includes("pumpfun") || h.includes("pump.fun") || h.includes("launchpad_smart") || /(^|\s)pump(\s|$)/.test(h)) return "PUMP";
  if (h.includes("binance")) return "BINANCE";
  if (/(^|\s)kol(\s|$)/.test(h) || h.includes("renowned") || row.smartKind === "kol") return "KOL";
  return "SMART";
}

export function rememberBuyer(
  bag: Array<{ handle: string; src: BuyerSrc }>,
  handle: string,
  src: BuyerSrc,
) {
  const name = handle.replace(/^@/, "");
  if (!name) return bag;
  const i = bag.findIndex((b) => b.handle.toLowerCase() === name.toLowerCase());
  if (i < 0) return [...bag, { handle: name, src }];
  if (SRC_RANK[src] > SRC_RANK[bag[i].src]) bag[i] = { handle: name, src };
  return bag;
}

export function formatBuyerLines(
  buyers: Array<{ handle: string; src: BuyerSrc }>,
  limit = 8,
  html = true,
) {
  const grouped = new Map<BuyerSrc, string[]>();
  for (const b of buyers) {
    const raw = b.handle.replace(/^@/, "");
    if (!raw) continue;
    const tag = `@${raw}`;
    const list = grouped.get(b.src) || [];
    if (!list.some((x) => x.toLowerCase() === tag.toLowerCase())) list.push(tag);
    grouped.set(b.src, list);
  }
  const n = Math.max(1, grouped.size);
  const per = Math.max(2, Math.ceil(limit / n));
  return SRC_ORDER.filter((s) => grouped.has(s)).map((s) => {
    const body = (grouped.get(s) || []).slice(0, per).join("  ");
    return `${s} ${html ? esc(body) : body}`;
  });
}

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "\u2014";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
}

function gmgnChain(chain: ChainId) {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  return chain;
}

function basedChain(chain: ChainId) {
  if (chain === "solana") return "sol";
  if (chain === "ethereum") return "eth";
  if (chain === "robinhood") return "rh";
  return chain;
}

export function tokenLinks(chain: ChainId, token: string) {
  const dex = `https://dexscreener.com/${chain}/${token}`;
  const gmgn = `https://gmgn.ai/${gmgnChain(chain)}/token/${token}`;
  const based = `https://basedbot.app/token/${basedChain(chain)}/${token}`;
  const banana = `https://t.me/BananaGunSniper_bot?start=snp_${chain.toUpperCase()}_${token}`;
  const maestro = `https://t.me/maestro?start=${token}`;
  const rick = `https://t.me/RickBurpBot?start=${token}`;
  const photon = chain === "solana" ? `https://photon-sol.tinyastro.io/en/lp/${token}` : null;
  const axiom = chain === "solana" ? `https://axiom.trade/t/${token}` : null;
  return { dex, gmgn, based, banana, maestro, rick, photon, axiom };
}

export function formatAlertHtml(hit: AlertHit) {
  const links = tokenLinks(hit.chain, hit.token);
  const win = hit.windowMin || 3;
  const pct =
    hit.change24 != null && Number.isFinite(hit.change24)
      ? `${hit.change24 >= 0 ? "+" : ""}${hit.change24.toFixed(1)}%`
      : "\u2014";
  const buyers =
    hit.buyers && hit.buyers.length
      ? hit.buyers
      : (hit.handles || []).map((h) => ({ handle: h, src: "SMART" as BuyerSrc }));
  const buyerLines = formatBuyerLines(buyers);
  const tier = formatTierLine(tierFromViews(hit.views || 0));
  const lines = [
    `<b>${hit.honeypot ? "\ud83d\udd34" : "\ud83d\udfe2"} BUY CLUSTER \u00b7 ${esc(hit.chain.toUpperCase())}</b>`,
    `<b>$${esc(hit.symbol)}</b>${hit.name && hit.name !== hit.symbol ? `  <i>${esc(hit.name)}</i>` : ""}`,
  ];
  if (tier) lines.push(tier);
  if (hit.honeypotLine) lines.push(hit.honeypotLine);
  lines.push(
    "",
    `<code>${esc(hit.token)}</code>`,
    "",
    `MC ${money(hit.mcap)}   LP ${money(hit.liquidity)}   24h ${esc(pct)}`,
    `${win}dk \u00b7 <b>${hit.buys}</b> al\u0131m \u00b7 <b>${money(hit.usd)}</b>`,
  );
  if (buyerLines.length) lines.push(...buyerLines);
  lines.push(
    "",
    `<a href="${links.dex}">DexScreener</a> \u00b7 <a href="${links.gmgn}">GMGN</a> \u00b7 <a href="${links.based}">BasedBot</a>`,
    `<a href="${links.banana}">BananaGun</a> \u00b7 <a href="${links.maestro}">Maestro</a> \u00b7 <a href="${links.rick}">Rick</a>`,
  );
  if (links.photon) lines.push(`<a href="${links.photon}">Photon</a> \u00b7 <a href="${links.axiom || links.dex}">Axiom</a>`);
  return lines.join("\n");
}

export function alertKeyboard(chain: ChainId, token: string) {
  const l = tokenLinks(chain, token);
  const row1 = [
    { text: "Dex", url: l.dex },
    { text: "GMGN", url: l.gmgn },
    { text: "Based", url: l.based },
  ];
  const row2 = [
    { text: "Banana", url: l.banana },
    { text: "Maestro", url: l.maestro },
    { text: "Rick", url: l.rick },
  ];
  const row3 = [] as Array<{ text: string; url: string }>;
  if (l.photon) row3.push({ text: "Photon", url: l.photon });
  if (l.axiom) row3.push({ text: "Axiom", url: l.axiom });
  return { inline_keyboard: row3.length ? [row1, row2, row3] : [row1, row2] };
}

export function clusterHits(tape: TapeFill[], windowMin: number, minUsd: number, minBuys: number): AlertHit[] {
  const since = Date.now() - windowMin * 60_000;
  const bag = new Map<string, AlertHit & { seen: Set<string> }>();
  for (const row of tape) {
    if (row.side !== "buy" || row.ts < since) continue;
    if (skipAlertToken(row)) continue;
    const key = `${row.chain}:${row.token.toLowerCase()}`;
    const prev =
      bag.get(key) ||
      ({
        token: row.token,
        chain: row.chain,
        symbol: row.symbol,
        name: row.name,
        usd: 0,
        buys: 0,
        windowMin,
        mcap: row.mcap,
        liquidity: row.liquidity,
        change24: row.change24,
        handles: [],
        buyers: [],
        seen: new Set<string>(),
      } as AlertHit & { seen: Set<string> });
    prev.usd += row.usd || 0;
    prev.buys += 1;
    if (row.mcap && !prev.mcap) prev.mcap = row.mcap;
    if (row.liquidity && !prev.liquidity) prev.liquidity = row.liquidity;
    if (row.change24 != null && prev.change24 == null) prev.change24 = row.change24;
    const h = (row.handle || "").replace(/^@/, "");
    if (h && !prev.seen.has(h.toLowerCase())) {
      prev.seen.add(h.toLowerCase());
      prev.handles = [...(prev.handles || []), h];
    }
    if (h) prev.buyers = rememberBuyer(prev.buyers || [], h, buyerSource(row));
    bag.set(key, prev);
  }
  return [...bag.values()]
    .filter((row) => row.usd >= minUsd && row.buys >= minBuys && (row.handles || []).length >= 2)
    .filter((row) => !row.mcap || mcapInAlertBand(row.mcap))
    .map(({ seen: _s, ...rest }) => rest);
}
