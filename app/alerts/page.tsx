"use client";

import { Shell } from "@/components/Shell";
import { DEFAULT_RULE } from "@/lib/watch";

export default function AlertsPage() {
  return (
    <Shell
      title="Telegram alert"
      subtitle="Eşik sadece sunucu cron. Tarayıcı alarm göndermez. DEFAULT_RULE / env: ALERT_WINDOW_MIN, ALERT_MIN_USD, ALERT_MIN_BUYS."
    >
      <p className="text-sm text-mute">
        Canlı kural: {DEFAULT_RULE.windowMin} dk · ${DEFAULT_RULE.minUsd} · {DEFAULT_RULE.minBuys} alım. cron-job.org
        her 5 dk <code>/api/cron/alerts</code> Bearer CRON_SECRET ile vurur.
      </p>
    </Shell>
  );
}
