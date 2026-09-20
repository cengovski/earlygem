export type ClientKeys = {
  gmgn?: string;
  binanceKey?: string;
  binanceSecret?: string;
  fomo?: string;
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
  const merged: ClientKeys = {
    gmgn: next.gmgn || prev.gmgn,
    binanceKey: next.binanceKey || prev.binanceKey,
    binanceSecret: next.binanceSecret || prev.binanceSecret,
    fomo: next.fomo || prev.fomo,
  };
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
