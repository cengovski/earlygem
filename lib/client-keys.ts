import { persistGet, persistSet } from "./persist";

export type ClientKeys = {
  gmgn?: string;
  binanceKey?: string;
  binanceSecret?: string;
  fomo?: string;
  cabalspy?: string;
  soltrack?: string;
  madeonsol?: string;
  bitquery?: string;
  telegramBot?: string;
  telegramChat?: string;
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
  return loadClientKeys().gmgn || "";
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
  };
}

export function clientTelegram() {
  const row = loadClientKeys();
  return { bot: row.telegramBot || "", chat: row.telegramChat || "" };
}
