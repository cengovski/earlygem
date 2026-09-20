const KEY = "earlygem.solmap";

export type SolMap = Record<string, string>;

export function readSolMap(): SolMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SolMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function rememberSol(handle: string, solana: string) {
  if (typeof window === "undefined" || !handle || !solana) return;
  const next = { ...readSolMap(), [handle.toLowerCase()]: solana };
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function attachSolana<T extends { handle: string; solana?: string | null }>(rows: T[], known: SolMap): T[] {
  const map = { ...known, ...readSolMap() };
  return rows.map((row) => {
    const extra = map[row.handle.toLowerCase()];
    return extra && !row.solana ? { ...row, solana: extra } : row;
  });
}
