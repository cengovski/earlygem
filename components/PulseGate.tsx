"use client";

import { useRadar } from "./RadarProvider";
import type { RadarBundle, RadarMeta } from "@/lib/store";

export function PulseGate({
  children,
}: {
  children: (bundle: RadarBundle & { meta: RadarMeta }) => React.ReactNode;
}) {
  const { bundle, loading } = useRadar();
  if (loading && !bundle) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">
        Pulse tarayıcıdan çekiliyor — Vercel IP değil, senin IP.
      </p>
    );
  }
  if (!bundle) {
    return (
      <p className="rounded-xl border border-line bg-surface p-6 text-sm text-mute">
        Pulse alınamadı. Worker Preview’da /api/status 200 olmalı. Sonra yenile.
      </p>
    );
  }
  return <>{children(bundle)}</>;
}
