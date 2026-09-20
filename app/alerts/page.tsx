"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { DEFAULT_RULE, type AlertRule } from "@/lib/watch";

export default function AlertsPage() {
  const [rule, setRule] = useState<AlertRule>(DEFAULT_RULE);
  const [msg, setMsg] = useState("");
  useEffect(() => {
    fetch("/api/alerts/rule")
      .then((r) => r.json())
      .then((row) => {
        if (row && row.windowMin) setRule(row);
      })
      .catch(() => undefined);
  }, []);
  return (
    <Shell
      title="Telegram alert"
      subtitle="Sunucu cron bu eşiği kullanır (ALERT_WINDOW_MIN / ALERT_MIN_USD / ALERT_MIN_BUYS). Tarayıcı alarm atmaz."
    >
      <form
        className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          setMsg(
            `canlı cron: ${rule.windowMin}dk / $${rule.minUsd} / ${rule.minBuys} alım — değişiklik Vercel env ile yazılır`,
          );
        }}
      >
        <label className="block text-sm">
          pencere (dk)
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1"
            type="number"
            min={1}
            value={rule.windowMin}
            onChange={(e) => setRule({ ...rule, windowMin: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          min alım USD
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1"
            type="number"
            min={100}
            value={rule.minUsd}
            onChange={(e) => setRule({ ...rule, minUsd: Number(e.target.value) })}
          />
        </label>
        <label className="block text-sm">
          min alım adedi
          <input
            className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1"
            type="number"
            min={1}
            value={rule.minBuys}
            onChange={(e) => setRule({ ...rule, minBuys: Number(e.target.value) })}
          />
        </label>
        <p className="text-xs text-mute">
          Kayıtlı sunucu değeri şu an 10 dk / $1000 / 5 alım. Formdaki sayıyı değiştirip söylemen yeterli; env’i ben yazarım.
        </p>
        {msg ? <p className="text-xs text-accent">{msg}</p> : null}
      </form>
    </Shell>
  );
}
