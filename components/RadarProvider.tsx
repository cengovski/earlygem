"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { clusterHits, type AlertHit } from "@/lib/alert-msg";
import { markFeeds } from "@/lib/health";
import { recentLogs, type LogEvent } from "@/lib/log";
import { bustRadarCache, fetchRadarBundle } from "@/lib/radar";
import type { RadarBundle, RadarMeta } from "@/lib/store";
import type { AlertRule } from "@/lib/watch";

const POLL_MS = 25_000;
const HANG_MS = 20_000;
const STALE_RELOAD_MS = 70_000;
const FIRED_KEY = "eg_alert_fired";

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

function readFired(): Record<string, number> {
  try {
    return JSON.parse(sessionStorage.getItem(FIRED_KEY) || "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

function writeFired(map: Record<string, number>) {
  sessionStorage.setItem(FIRED_KEY, JSON.stringify(map));
}

async function pushHits(hits: AlertHit[]) {
  if (!hits.length) return;
  await fetch("/api/admin/push-alerts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hits }),
  });
}

export function RadarProvider({ children }: { children: React.ReactNode }) {
  const [bundle, setBundle] = useState<RadarState["bundle"]>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [tick, setTick] = useState(0);
  const [rule, setRule] = useState<AlertRule>({ windowMin: 10, minUsd: 1000, minBuys: 5 });
  const lastOk = useRef(Date.now());
  const started = useRef(0);

  const bump = useCallback(() => {
    bustRadarCache();
    setTick((n) => n + 1);
  }, []);

  useEffect(() => {
    fetch("/api/alert-rule", { cache: "no-store" })
      .then((r) => r.json())
      .then((row: AlertRule) => {
        if (row?.windowMin) setRule(row);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    started.current = Date.now();
    setLoading(true);
    fetchRadarBundle({ force: true })
      .then(async (next) => {
        if (!alive) return;
        setBundle(next);
        lastOk.current = Date.now();
        markFeeds(next.tape, next.traders);
        const hits = clusterHits(next.tape, rule.windowMin, rule.minUsd, rule.minBuys);
        const fired = readFired();
        const live = new Set(hits.map((h) => `${h.chain}:${h.token.toLowerCase()}`));
        for (const key of Object.keys(fired)) {
          if (!live.has(key)) delete fired[key];
        }
        const fresh = hits.filter((h) => !fired[`${h.chain}:${h.token.toLowerCase()}`]);
        if (fresh.length) {
          await pushHits(fresh);
          const now = Date.now();
          for (const h of fresh) fired[`${h.chain}:${h.token.toLowerCase()}`] = now;
        }
        writeFired(fired);
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
  }, [tick, rule]);

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
