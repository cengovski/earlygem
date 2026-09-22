"use client";

import { useEffect, useMemo, useState } from "react";
import { formatBuyerLines, mcapInAlertBand } from "@/lib/alert-msg";
import { usd } from "@/lib/format";
import { alertStatus, clusterNear, loadAlertRule, onAlertStatus } from "@/lib/alert-engine";
import { telegramConfigured } from "@/lib/telegram";
import type { TapeFill } from "@/lib/types";
import { DEFAULT_RULE, type AlertRule } from "@/lib/watch";

export function AlertRadar({ tape }: { tape: TapeFill[] }) {
  const [rule, setRule] = useState<AlertRule>(DEFAULT_RULE);
  const [status, setStatus] = useState<Record<string, string>>({});
  const [tgOn, setTgOn] = useState(false);

  useEffect(() => {
    const tick = () => {
      const next = loadAlertRule();
      setRule((prev) =>
        prev.windowMin === next.windowMin && prev.minUsd === next.minUsd && prev.minBuys === next.minBuys ? prev : next,
      );
      setTgOn(telegramConfigured());
      setStatus(alertStatus());
    };
    tick();
    const id = window.setInterval(tick, 4_000);
    const stop = onAlertStatus(() => setStatus(alertStatus()));
    window.addEventListener("storage", tick);
    window.addEventListener("eg-keys", tick);
    return () => {
      window.clearInterval(id);
      stop();
      window.removeEventListener("storage", tick);
      window.removeEventListener("eg-keys", tick);
    };
  }, []);

  const rows = useMemo(() => clusterNear(tape, rule), [tape, rule]);

  return (
    <aside className="w-full shrink-0 rounded-xl border border-line bg-surface lg:w-72">
      <div className="border-b border-line px-3 py-2">
        <p className="text-sm font-medium">Eşiğe yaklaşan</p>
        <p className="text-[11px] text-mute">
          {rule.windowMin}dk havuz · ${rule.minUsd} · {rule.minBuys} alım · MC $250k–$25M
          {tgOn ? "" : " · telegram key yok"}
        </p>
      </div>
      {!rows.length ? (
        <p className="px-3 py-4 text-xs text-mute">Bu 10 dk havuzda küme yok.</p>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((row) => {
            const mcapOut = row.mcapLast != null && row.mcapLast > 0 && !mcapInAlertBand(row.mcapLast);
            const ready = row.usd >= rule.minUsd && row.buys >= rule.minBuys && row.handles.length >= 2 && !mcapOut;
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
                </p>
                {status[row.key] ? <p className="text-[11px] text-mute">{status[row.key]}</p> : null}
                {row.buyers.length ? (
                  <p className="truncate text-[11px] text-mute">{formatBuyerLines(row.buyers, 4, false).join(" · ")}</p>
                ) : row.handles.length ? (
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
