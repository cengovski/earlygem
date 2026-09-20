"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { recentLogs, type LogEvent } from "@/lib/log";
import { fetchRadarBundle } from "@/lib/radar";
import type { RadarBundle, RadarMeta } from "@/lib/store";

const POLL_MS = 30_000;

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
    fetchRadarBundle({ force: true })
      .then((next) => {
        if (!alive) return;
        setBundle(next);
      })
      .catch(() => {
        if (!alive) return;
        if (first) setBundle(null);
      })
      .finally(() => {
        if (!alive) return;
        setLogs(recentLogs(40));
        setLoading(false);
      });
    return () => {
      alive = false;
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
