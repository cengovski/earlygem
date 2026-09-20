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
      subtitle="Tape bellekte şişmez. Sadece eşik aşılınca BotFather botuna bir satır gider. 15 dk aynı token tekrarlanmaz."
    >
      <ol className="mb-6 list-decimal space-y-1 pl-5 text-sm text-mute">
        <li>Telegram’da @BotFather → /newbot</li>
        <li>Token’i Vercel env: TELEGRAM_BOT_TOKEN</li>
        <li>Bota bir mesaj at, sonra @userinfobot ile chat id al</li>
        <li>Vercel env: TELEGRAM_CHAT_ID</li>
        <li>Redeploy + aşağıdan test</li>
      </ol>
      <form
        className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          saveRule(rule);
          setMsg("eşik tarayıcıda kaydedildi");
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
        <div className="flex gap-2">
          <button type="submit" className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]">
            kaydet
          </button>
          <button
            type="button"
            className="rounded-md border border-line px-3 py-1 text-sm"
            onClick={async () => {
              const res = await fetch("/api/telegram", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ test: true }),
              });
              const json = (await res.json()) as { ok?: boolean; error?: string };
              setMsg(json.ok ? "test gitti" : json.error || "env yok");
            }}
          >
            test mesaj
          </button>
        </div>
        {msg ? <p className="text-xs text-mute">{msg}</p> : null}
      </form>
    </Shell>
  );
}
