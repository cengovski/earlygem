"use client";

import { useState } from "react";
import { useRadar } from "./RadarProvider";

export function RefreshButton({ label = "yenile" }: { label?: string }) {
  const radar = useRadar();
  const [busy, setBusy] = useState(false);

  function onClick() {
    setBusy(true);
    radar.reload();
    window.setTimeout(() => setBusy(false), 400);
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || radar.loading}
      className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-mute hover:text-accent disabled:opacity-60"
    >
      {busy || radar.loading ? "yenileniyor…" : label}
    </button>
  );
}
