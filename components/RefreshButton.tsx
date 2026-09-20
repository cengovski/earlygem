"use client";

import { useState } from "react";

export function RefreshButton({ label = "yenile" }: { label?: string }) {
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/refresh", { method: "POST", cache: "no-store" });
    } catch {
      /* hard reload below still busts the page */
    }
    const url = new URL(window.location.href);
    url.searchParams.set("_r", String(Date.now()));
    window.location.replace(url.toString());
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-mute hover:text-accent disabled:opacity-60"
    >
      {busy ? "yenileniyor…" : label}
    </button>
  );
}
