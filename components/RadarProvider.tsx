"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { recentLogs, type LogEvent } from "@/lib/log";
import { fetchRadarBundle } from "@/lib/radar";
import type { RadarBundle, RadarMeta } from "@/lib/store";
import { fireTapeAlerts } from "@/lib/watch";

const POLL_MS = 45_000;

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

export function RadarProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<RadarState["bundle"]>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    const first = !bundle;
    if (first) setLoading(true);
    const timer = window.setTimeout(() => {
      if (alive) setLoading(false);
    }, 12_000);
    fetchRadarBundle({ force: true })
      .then((next) => {
        if (!alive) return;
        setBundle(next);
        fireTapeAlerts(next.tape.slice(0, 200)).catch(() => null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!alive) return;
        window.clearTimeout(timer);
        setLogs(recentLogs(40));
        setLoading(false);
      });
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const value = useMemo(() => ({ bundle, loading, logs, reload }), [bundle, loading, logs, reload]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRadar() {
  return useContext(Ctx);
}
