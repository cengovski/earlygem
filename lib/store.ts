import type { Gem, PulseStatus, TapeFill, Trader } from "./types";

export type RadarBundle = {
  traders: Trader[];
  tape: TapeFill[];
  gems: Gem[];
  featured: Gem[];
  smartTape: TapeFill[];
  dexWatch: Gem[];
  status: PulseStatus | null;
  solTape: TapeFill[];
  solGems: Gem[];
};

export type RadarMeta = {
  fetchedAt: string;
  ageMs: number;
  fromCache: boolean;
  fallback: boolean;
  pulseOk: boolean;
  tradersSource: "pulse" | "tape" | "none";
  errors: string[];
};

type Slot = {
  at: number;
  bundle: RadarBundle;
  meta: Omit<RadarMeta, "fromCache" | "ageMs">;
};

const g = globalThis as typeof globalThis & { __earlygemStore?: { slot: Slot | null } };

function bucket() {
  if (!g.__earlygemStore) g.__earlygemStore = { slot: null };
  return g.__earlygemStore;
}

function withSol(bundle: RadarBundle): RadarBundle {
  return { ...bundle, solTape: bundle.solTape || [], solGems: bundle.solGems || [] };
}

export function readSnapshot(maxAgeMs: number): { bundle: RadarBundle; meta: RadarMeta } | null {
  const slot = bucket().slot;
  if (!slot) return null;
  const ageMs = Date.now() - slot.at;
  if (ageMs > maxAgeMs) return null;
  return {
    bundle: withSol(slot.bundle),
    meta: { ...slot.meta, fetchedAt: new Date(slot.at).toISOString(), ageMs, fromCache: true },
  };
}

export function lastSnapshot(): { bundle: RadarBundle; meta: RadarMeta } | null {
  const slot = bucket().slot;
  if (!slot) return null;
  return {
    bundle: withSol(slot.bundle),
    meta: {
      ...slot.meta,
      fetchedAt: new Date(slot.at).toISOString(),
      ageMs: Date.now() - slot.at,
      fromCache: true,
      fallback: true,
    },
  };
}

export function writeSnapshot(bundle: RadarBundle, meta: Omit<RadarMeta, "fromCache" | "ageMs" | "fetchedAt">) {
  bucket().slot = { at: Date.now(), bundle: withSol(bundle), meta: { ...meta, fetchedAt: new Date().toISOString() } };
}

export function clearSnapshot() {
  bucket().slot = null;
}
