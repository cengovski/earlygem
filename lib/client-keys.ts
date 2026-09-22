import { persistGet, persistSet } from "./persist";

export type ClientKeys = {
  /** GMGN key used on the PC / browser IP (direct openapi.gmgn.ai). */
  gmgn?: string;
  /** GMGN key used on the VPS / site proxy IP. */
  gmgn2?: string;
  /** Ed25519/RSA private PEM used when creating the GMGN API key. Needed for follow_wallet. Never sent to our server. */
  gmgnPem?: string;
  /** Absolute VPS proxy, e.g. https://earlygem-live.vercel.app/api/gmgn. Empty = /api/gmgn in the browser. */
  gmgnProxy?: string;
  binanceKey?: string;
  binanceSecret?: string;
  fomo?: string;
  cabalspy?: string;
  soltrack?: string;
  madeonsol?: string;
  bitquery?: string;
  telegramBot?: string;
  telegramChat?: string;
  goplus?: string;
  goplusSecret?: string;
  honeypotis?: string;
  nansen?: string;
  /** Newline/comma Solana wallets you pasted. Not scraped from Nansen. */
  watchSol?: string;
};

const STORE = "eg_client_keys";

export function loadClientKeys(): ClientKeys {
  try {
    return JSON.parse(persistGet(STORE) || "{}") as ClientKeys;
  } catch {
    return {};
  }
}

export function saveClientKeys(next: ClientKeys) {
  const prev = loadClientKeys();
  const merged: ClientKeys = { ...prev, ...next };
  persistSet(STORE, JSON.stringify(merged));
  if (typeof window !== "undefined") window.dispatchEvent(new Event("eg-keys"));
  return merged;
}

export function clientGmgnKey() {
  const row = loadClientKeys();
  return row.gmgn || row.gmgn2 || "";
}

export function gmgnLaneKeys() {
  const row = loadClientKeys();
  const pc = row.gmgn || process.env.GMGN_API_KEY || "";
  const vps = row.gmgn2 || process.env.GMGN_API_KEY_2 || "";
  return {
    pc: pc || vps,
    vps: vps || pc,
    proxy: (row.gmgnProxy || process.env.GMGN_PROXY || "").trim().replace(/\/$/, ""),
  };
}

export function clientBinance() {
  const row = loadClientKeys();
  return { key: row.binanceKey || "", secret: row.binanceSecret || "" };
}

export function clientExtraKeys() {
  const row = loadClientKeys();
  return {
    cabalspy: row.cabalspy || process.env.CABALSPY_KEY || "",
    soltrack: row.soltrack || process.env.SOLTRACK_KEY || "",
    madeonsol: row.madeonsol || process.env.MADEONSOL_KEY || "",
    bitquery: row.bitquery || process.env.BITQUERY_KEY || "",
    nansen: row.nansen || process.env.NANSEN_API_KEY || "",
  };
}

export function clientTelegram() {
  const row = loadClientKeys();
  return { bot: row.telegramBot || "", chat: row.telegramChat || "" };
}
