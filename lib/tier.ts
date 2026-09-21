import { persistGet, persistSet } from "./persist";

export const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "emerald", "diamond"] as const;
export type TierName = (typeof TIER_ORDER)[number];

export type TierInfo = {
  views: number;
  tier: TierName | null;
  label: string;
  emoji: string;
};

const EMOJI: Record<TierName, string> = {
  bronze: "\uD83E\uDD49",
  silver: "\uD83E\uDD48",
  gold: "\uD83E\uDD47",
  platinum: "\uD83D\uDC8E",
  emerald: "\uD83D\uDC9A",
  diamond: "\uD83D\uDC8E",
};

const TITLE: Record<TierName, string> = {
  bronze: "BRONZE",
  silver: "SILVER",
  gold: "GOLD",
  platinum: "PLATINUM",
  emerald: "EMERALD",
  diamond: "DIAMOND",
};

const KEY = "eg_token_views";
const DAY = 24 * 60 * 60_000;

function readMap(): Record<string, { n: number; at: number }> {
  try {
    return JSON.parse(persistGet(KEY) || "{}") as Record<string, { n: number; at: number }>;
  } catch {
    return {};
  }
}

function writeMap(map: Record<string, { n: number; at: number }>) {
  const cutoff = Date.now() - 3 * DAY;
  const next: Record<string, { n: number; at: number }> = {};
  for (const [k, v] of Object.entries(map)) if (v.at > cutoff) next[k] = v;
  persistSet(KEY, JSON.stringify(next));
}

export function tierFromViews(views: number): TierInfo {
  if (views < 2) return { views, tier: null, label: "",
    emoji: "" };
  const idx = Math.min(views - 2, TIER_ORDER.length - 1);
  const tier = TIER_ORDER[idx];
  return { views, tier, label: TITLE[tier], emoji: EMOJI[tier] };
}

export function bumpTokenViews(chain: string, token: string): TierInfo {
  const key = `${chain}:${token.toLowerCase()}`;
  const map = readMap();
  const prev = map[key] || { n: 0, at: 0 };
  const next = { n: prev.n + 1, at: Date.now() };
  map[key] = next;
  writeMap(map);
  return tierFromViews(next.n);
}

export function peekTokenViews(chain: string, token: string): TierInfo {
  const key = `${chain}:${token.toLowerCase()}`;
  const n = readMap()[key]?.n || 0;
  return tierFromViews(n);
}

export function formatTierLine(info: TierInfo) {
  if (!info.tier) return "";
  return `${info.emoji} <b>${info.label}</b> \u00b7 ${info.views}. görüntüleme`;
}
