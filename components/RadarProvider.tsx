"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { markFeeds } from "@/lib/health";
import { recentLogs, type LogEvent } from "@/lib/log";
import { ingestPool, readPool } from "@/lib/pool";
import { bustRadarCache, fetchRadarBundle } from "@/lib/radar";
import type { RadarBundle, RadarMeta } from "@/lib/store";
import { WINDOW_MIN } from "@/lib/window";

const POLL_MS = 25_000;
const HANG_MS = 20_000;
const STALE_RELOAD_MS = 70_000;

type RadarState = {
  bundle: (RadarBundle & { meta: RadarMeta }) | null;
  loading: boolean;
  logs: LogEvent[];
  reload: () => void;
};

const EMPTY: RadarState = {
  bundle: null,
  loading: true,
  logs: [],
  reload: () => {},
};

const Ctx = createContext<RadarState>(EMPTY);

function withPool(bundle: RadarBundle & { meta: RadarMeta }, incoming: typeof bundle.tape) {
  const tape = ingestPool([...(incoming || []), ...(bundle.solTape || [])], WINDOW_MIN);
  const solTape = tape.filter((row) => row.chain === "solana");
  const smartTape = tape.filter((r) => r.smartKind === "kol" || r.smartKind === "smart").slice(0, 80);
  return { ...bundle, tape, solTape, smartTape };
}

export function RadarProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<RadarState["bundle"]>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [tick, setTick] = useState(0);
  const lastOk = useRef(Date.now());
  const started = useRef(0);

  const bump = useCallback(() => {
    bustRadarCache();
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    const cached = readPool(WINDOW_MIN);
    if (!cached.length) return;
    setBundle({
      traders: [],
      tape: cached,
      gems: [],
      featured: [],
      smartTape: cached.filter((r) => r.smartKind === "kol" || r.smartKind === "smart").slice(0, 80),
      dexWatch: [],
      status: null,
      solTape: cached.filter((r) => r.chain === "solana"),
      solGems: [],
      meta: {
        fetchedAt: new Date().toISOString(),
        ageMs: 0,
        fromCache: true,
        fallback: true,
        pulseOk: true,
        tradersSource: "tape",
        errors: [],
      },
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let alive = true;
    started.current = Date.now();
    setLoading(true);
    fetchRadarBundle({ force: true })
      .then((next) => {
        if (!alive) return;
        const pooled = withPool(next, next.tape);
        setBundle(pooled);
        lastOk.current = Date.now();
        markFeeds(pooled.tape, next.traders);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        setLogs(recentLogs(40));
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [tick]);

  useEffect(() => {
    const poll = window.setInterval(() => bump(), POLL_MS);
    const watch = window.setInterval(() => {
      const now = Date.now();
      if (loading && now - started.current > HANG_MS) {
        setLoading(false);
        bump();
        return;
      }
      if (!loading && now - lastOk.current > STALE_RELOAD_MS) bump();
    }, 5_000);
    const onVis = () => {
      if (document.visibilityState === "visible" && Date.now() - lastOk.current > 20_000) bump();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(watch);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [bump, loading]);

  const value = useMemo(() => ({ bundle, loading, logs, reload: bump }), [bundle, loading, logs, bump]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRadar() {
  return useContext(Ctx);
}
