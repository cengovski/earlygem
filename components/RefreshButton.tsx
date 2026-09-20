"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      await fetch("/api/refresh", { method: "POST", cache: "no-store" });
      router.refresh();
    } finally {
      setTimeout(() => setBusy(false), 600);
    }
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-md border border-line bg-surface px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-mute hover:text-accent disabled:opacity-60"
    >
      {busy ? "yenileniyor…" : "yenile"}
    </button>
  );
}
