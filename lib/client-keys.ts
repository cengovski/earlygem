export type ClientKeys = {
  gmgn?: string;
  binanceKey?: string;
  binanceSecret?: string;
  fomo?: string;
  cabalspy?: string;
  soltrack?: string;
  madeonsol?: string;
  bitquery?: string;
};

const STORE = "eg_client_keys";

export function loadClientKeys(): ClientKeys {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE) || "{}") as ClientKeys;
  } catch {
    return {};
  }
}

export function saveClientKeys(next: ClientKeys) {
  if (typeof window === "undefined") return;
  const prev = loadClientKeys();
  const merged: ClientKeys = { ...prev, ...next };
  localStorage.setItem(STORE, JSON.stringify(merged));
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
    cabalspy: row.cabalspy || process.env.NEXT_PUBLIC_CABALSPY_KEY || "",
    soltrack: row.soltrack || process.env.NEXT_PUBLIC_SOLTRACK_KEY || "",
    madeonsol: row.madeonsol || process.env.NEXT_PUBLIC_MADEONSOL_KEY || "",
    bitquery: row.bitquery || process.env.NEXT_PUBLIC_BITQUERY_KEY || "",
  };
}
