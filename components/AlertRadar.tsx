"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { isWrappedBase } from "@/lib/alert-msg";
import { usd } from "@/lib/format";
import type { TapeFill } from "@/lib/types";
import type { AlertRule } from "@/lib/watch";

type Row = {
  key: string;
  chain: string;
  symbol: string;
  token: string;
  usd: number;
  buys: number;
  handles: string[];
};

function near(tape: TapeFill[], rule: AlertRule): Row[] {
  const since = Date.now() - rule.windowMin * 60_000;
  const bag = new Map<string, Row & { seen: Set<string> }>();
  for (const row of tape) {
    if (row.side !== "buy" || row.ts < since) continue;
    if (isWrappedBase(row.token, row.symbol, row.name)) continue;
    const key = `${row.chain}:${row.token.toLowerCase()}`;
    const prev = bag.get(key) || {
      key,
      chain: row.chain,
      symbol: row.symbol,
      token: row.token,
      usd: 0,
      buys: 0,
      handles: [],
      seen: new Set<string>(),
    };
    prev.usd += row.usd || 0;
    prev.buys += 1;
    const h = (row.handle || "").replace(/^@/, "");
    if (h && !prev.seen.has(h.toLowerCase())) {
      prev.seen.add(h.toLowerCase());
      prev.handles.push(h);
    }
    bag.set(key, prev);
  }
  return [...bag.values()]
    .filter((row) => row.buys >= 2 || row.usd >= rule.minUsd * 0.35)
    .sort((a, b) => b.usd / rule.minUsd + b.buys / rule.minBuys - (a.usd / rule.minUsd + a.buys / rule.minBuys))
    .slice(0, 12);
}

export function AlertRadar({ tape }: { tape: TapeFill[] }) {
  const [rule, setRule] = useState<AlertRule>({ windowMin: 10, minUsd: 1000, minBuys: 5 });
  const [status, setStatus] = useState<Record<string, string>>({});
  const sent = useRef(new Set<string>());

  useEffect(() => {
    fetch("/api/alert-rule", { cache: "no-store" })
      .then((r) => r.json())
      .then((row: AlertRule) => {
        if (row?.windowMin) setRule(row);
      })
      .catch(() => undefined);
  }, []);

  const rows = useMemo(() => near(tape, rule), [tape, rule]);

  useEffect(() => {
    const ready = rows.filter((row) => row.usd >= rule.minUsd && row.buys >= rule.minBuys && row.handles.length >= 2);
    const fresh = ready.filter((row) => !sent.current.has(row.key));
    if (!fresh.length) return;
    let cancel = false;
    setStatus((prev) => {
      const next = { ...prev };
      for (const row of fresh) next[row.key] = "tg…";
      return next;
    });
    fetch("/api/alert-fire", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        hits: fresh.map((row) => ({
          token: row.token,
          chain: row.chain,
          symbol: row.symbol,
          usd: row.usd,
          buys: row.buys,
          windowMin: rule.windowMin,
          handles: row.handles,
        })),
      }),
    })
      .then(async (res) => {
        const json = (await res.json()) as { ok?: boolean; sent?: number; skipped?: number; error?: string };
        if (cancel) return;
        setStatus((prev) => {
          const next = { ...prev };
          for (const row of fresh) {
            if (!res.ok) next[row.key] = json.error || `tg ${res.status}`;
            else if ((json.sent || 0) + (json.skipped || 0) > 0) {
              sent.current.add(row.key);
              next[row.key] = json.sent ? "tg ✓" : "tg bekler";
            } else next[row.key] = "tg yok";
          }
          return next;
        });
      })
      .catch(() => {
        if (cancel) return;
        setStatus((prev) => {
          const next = { ...prev };
          for (const row of fresh) next[row.key] = "tg hata";
          return next;
        });
      });
    return () => {
      cancel = true;
    };
  }, [rows, rule]);

  return (
    <aside className="w-full shrink-0 rounded-xl border border-line bg-surface lg:w-72">
      <div className="border-b border-line px-3 py-2">
        <p className="text-sm font-medium">Eşiğe yaklaşan</p>
        <p className="text-[11px] text-mute">
          {rule.windowMin}dk · ${rule.minUsd} · {rule.minBuys} alım
        </p>
      </div>
      {!rows.length ? (
        <p className="px-3 py-4 text-xs text-mute">Bu pencerede küme yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const ready = row.usd >= rule.minUsd && row.buys >= rule.minBuys;
            return (
              <li key={row.key} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <a className="truncate font-medium hover:text-accent" href={`/token/${row.chain}/${row.token}`}>
                    ${row.symbol}
                  </a>
                  <span className="font-mono text-[11px] uppercase text-mute">{row.chain}</span>
                </div>
                <p className="mt-0.5 font-mono text-xs">
                  {usd(row.usd)} · {row.buys} alım
                  {ready ? <span className="ml-2 text-[#7dff8a]">eşik</span> : null}
                  {status[row.key] ? <span className="ml-2 text-mute">{status[row.key]}</span> : null}
                </p>
                {row.handles.length ? (
                  <p className="truncate text-[11px] text-mute">@{row.handles.slice(0, 3).join(" @")}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
