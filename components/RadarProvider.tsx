"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { attachRosterFlags } from "@/lib/alert-msg";
import { markFeeds } from "@/lib/health";
import { installBrowserFaultHooks, logEvent, onLog, recentLogs, type LogEvent } from "@/lib/log";
import { hydrateFills } from "@/lib/dexmeta";
import { ingestPool, readPool, writePool } from "@/lib/pool";
import { bustRadarCache, fetchRadarBundle } from "@/lib/radar";
import type { RadarBundle, RadarMeta } from "@/lib/store";
import { runAlertPass } from "@/lib/alert-engine";
import type { TapeFill } from "@/lib/types";
import { maybeFlushHourDigest } from "@/lib/hour-client";
import { installGmgnTrackBridge } from "@/lib/gmgn-bridge";
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

function withTape<T extends RadarBundle & { meta: RadarMeta }>(bundle: T, tape: TapeFill[]) {
  const solTape = tape.filter((row) => row.chain === "solana");
  const smartTape = tape.filter((r) => r.smartKind === "kol" || r.smartKind === "smart").slice(0, 80);
  return { ...bundle, tape, solTape, smartTape };
}

function withPool(bundle: RadarBundle & { meta: RadarMeta }, incoming: typeof bundle.tape) {
  const stamped = attachRosterFlags([...(incoming || []), ...(bundle.solTape || [])], bundle.traders || []);
  return withTape(bundle, ingestPool(stamped, WINDOW_MIN));
}

async function refreshMcaps(tape: TapeFill[]) {
  await runAlertPass(tape);
  return writePool(await hydrateFills(readPool(WINDOW_MIN), 40));
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
    void refreshMcaps(cached).then((tape) => {
      setBundle((prev) => (prev ? withTape(prev, tape) : prev));
    });
  }, []);

  useEffect(() => {
    installBrowserFaultHooks();
    installGmgnTrackBridge();
    setLogs(recentLogs(40));
    return onLog(() => setLogs(recentLogs(40)));
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
        void refreshMcaps(pooled.tape).then((tape) => {
          if (!alive) return;
          setBundle((prev) => (prev ? withTape(prev, tape) : prev));
        });
      })
      .catch((err) => {
        logEvent({
          level: "error",
          event: "radar",
          outcome: "error",
          kind: "connection",
          detail: err instanceof Error ? err.message : "radar_fail",
        });
      })
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
        logEvent({
          level: "error",
          event: "radar",
          outcome: "error",
          kind: "timeout",
          detail: `hang>${HANG_MS}ms`,
        });
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
    const hour = window.setInterval(() => {
      void maybeFlushHourDigest();
    }, 30_000);
    const onKeys = () => {
      const tape = readPool(WINDOW_MIN);
      if (tape.length) void refreshMcaps(tape).then((next) => setBundle((prev) => (prev ? withTape(prev, next) : prev)));
    };
    window.addEventListener("eg-keys", onKeys);
    window.addEventListener("storage", onKeys);
    window.addEventListener("eg-gmgn-track", onKeys);
    void maybeFlushHourDigest();
    return () => {
      window.clearInterval(poll);
      window.clearInterval(watch);
      window.clearInterval(hour);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("eg-keys", onKeys);
      window.removeEventListener("storage", onKeys);
      window.removeEventListener("eg-gmgn-track", onKeys);
    };
  }, [bump, loading]);

  const value = useMemo(() => ({ bundle, loading, logs, reload: bump }), [bundle, loading, logs, bump]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRadar() {
  return useContext(Ctx);
}
