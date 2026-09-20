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
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function money(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
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

function dexChain(chain: ChainId) {
  return chain;
}

export function tokenLinks(chain: ChainId, token: string) {
  const dex = `https://dexscreener.com/${dexChain(chain)}/${token}`;
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
      : "—";
  const handles = (hit.handles || []).slice(0, 4).map((h) => (h.startsWith("@") ? h : `@${h}`));
  const lines = [
    `<b>🟢 BUY CLUSTER · ${esc(hit.chain.toUpperCase())}</b>`,
    `<b>$${esc(hit.symbol)}</b>${hit.name && hit.name !== hit.symbol ? `  <i>${esc(hit.name)}</i>` : ""}`,
    "",
    `<code>${esc(hit.token)}</code>`,
    "",
    `MC ${money(hit.mcap)}   LP ${money(hit.liquidity)}   24h ${esc(pct)}`,
    `${win}dk · <b>${hit.buys}</b> alım · <b>${money(hit.usd)}</b>`,
  ];
  if (handles.length) lines.push(`KOL ${esc(handles.join("  "))}`);
  lines.push(
    "",
    `<a href="${links.dex}">DexScreener</a> · <a href="${links.gmgn}">GMGN</a> · <a href="${links.based}">BasedBot</a>`,
    `<a href="${links.banana}">BananaGun</a> · <a href="${links.maestro}">Maestro</a> · <a href="${links.rick}">Rick</a>`,
  );
  if (links.photon) lines.push(`<a href="${links.photon}">Photon</a> · <a href="${links.axiom || links.dex}">Axiom</a>`);
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
    bag.set(key, prev);
  }
  return [...bag.values()]
    .filter((row) => row.usd >= minUsd && row.buys >= minBuys)
    .map(({ seen: _s, ...rest }) => rest);
}
