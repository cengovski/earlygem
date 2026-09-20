"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import type { AlertRule } from "@/lib/watch";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [password, setPassword] = useState("");
  const [rule, setRule] = useState<AlertRule>({ windowMin: 10, minUsd: 1000, minBuys: 5 });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/admin/me")
      .then((r) => r.json())
      .then(async (row: { ok?: boolean }) => {
        if (!row.ok) return;
        setAuthed(true);
        const ruleRes = await fetch("/api/admin/rule");
        if (ruleRes.ok) setRule(await ruleRes.json());
      })
      .catch(() => undefined);
  }, []);

  if (!authed) {
    return (
      <Shell title="Admin" subtitle="Sadece sen. Şifre Vercel ADMIN_PASSWORD.">
        <form
          className="max-w-sm space-y-3 rounded-xl border border-line bg-surface p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const res = await fetch("/api/admin/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ password }),
            });
            const json = (await res.json()) as { ok?: boolean; error?: string };
            if (!json.ok) {
              setMsg(json.error || "giriş yok");
              return;
            }
            setAuthed(true);
            const ruleRes = await fetch("/api/admin/rule");
            if (ruleRes.ok) setRule(await ruleRes.json());
            setMsg("");
          }}
        >
          <label className="block text-sm">
            şifre
            <input
              className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
            gir
          </button>
          {msg ? <p className="text-xs text-mute">{msg}</p> : null}
        </form>
      </Shell>
    );
  }

  return (
    <Shell title="Admin · eşik" subtitle="Kayıt cron’un kullandığı kuraldır. Başkası bu sayfayı açsa bile şifresiz kaydedemez.">
      <form
        className="max-w-md space-y-3 rounded-xl border border-line bg-surface p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const res = await fetch("/api/admin/rule", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(rule),
          });
          const json = (await res.json()) as { ok?: boolean; persisted?: string; error?: string };
          setMsg(json.ok ? `kaydedildi (${json.persisted || "ok"})` : json.error || "hata");
        }}
      >
        <label className="block text-sm">
          pencere (dk)
          <input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={1} value={rule.windowMin} onChange={(e) => setRule({ ...rule, windowMin: Number(e.target.value) })} />
        </label>
        <label className="block text-sm">
          min alım USD
          <input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={100} value={rule.minUsd} onChange={(e) => setRule({ ...rule, minUsd: Number(e.target.value) })} />
        </label>
        <label className="block text-sm">
          min alım adedi
          <input className="mt-1 w-full rounded-md border border-line bg-[#12110c] px-2 py-1" type="number" min={1} value={rule.minBuys} onChange={(e) => setRule({ ...rule, minBuys: Number(e.target.value) })} />
        </label>
        <div className="flex gap-2">
          <button className="rounded-md bg-accent px-3 py-1 text-sm text-[#16140c]" type="submit">
            kaydet
          </button>
          <button
            className="rounded-md border border-line px-3 py-1 text-sm"
            type="button"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              setAuthed(false);
              setPassword("");
            }}
          >
            çık
          </button>
        </div>
        {msg ? <p className="text-xs text-mute">{msg}</p> : null}
      </form>
    </Shell>
  );
}
