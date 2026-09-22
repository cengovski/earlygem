"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { DEFAULT_RULE, loadRule, saveRule, type AlertRule } from "@/lib/watch";

export default function AlertsPage() {
  const [rule, setRule] = useState<AlertRule>(DEFAULT_RULE);
  const [msg, setMsg] = useState("");
  useEffect(() => setRule(loadRule()), []);
  return (
    <Shell
      title="Telegram alert"
      subtitle="Eşik bu tarayıcıda. Tape’deki 20 dk havuz eşiği doldurunca alarm tarayıcıdan (senin IP) gider."
    >
      <form
        className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveRule(rule);
          setMsg(`kaydedildi: ${rule.windowMin}dk / $${rule.minUsd} / ${rule.minBuys} alım`);
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
        <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
          kaydet
        </button>
        {msg ? <p className="text-xs text-accent">{msg}</p> : null}
      </form>
    </Shell>
  );
}
