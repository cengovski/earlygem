"use client";

import Link from "next/link";
import { RefreshButton } from "./RefreshButton";
import { SourceDots } from "./SourceDots";
import { GmgnTrackIngestBar } from "./GmgnTrackIngestBar";
import { useRadar } from "./RadarProvider";
import { isFault } from "@/lib/log";

const LINKS = [
  { href: "/", label: "Radar" },
  { href: "/tape", label: "Tape" },
  { href: "/gems", label: "Gemler" },
  { href: "/traders", label: "Traderlar" },
  { href: "/whales", label: "Whales" },
  { href: "/alerts", label: "Alert" },
  { href: "/admin", label: "Admin" },
  { href: "/find", label: "Cüzdan bul" },
  { href: "/logs", label: "Log" },
];

export function Shell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  const { logs } = useRadar();
  const broken = logs.filter(isFault).length;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line/80 bg-[#12110c]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-accent font-mono text-xs text-[#16140c]">eg</span>
            <span>earlygem</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1 text-sm">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-md px-2.5 py-1 text-mute hover:bg-surface hover:text-ink">
                {l.label}
                {l.href === "/logs" && broken ? (
                  <span className="ml-1 rounded-sm bg-[#ff5a5a] px-1 font-mono text-[10px] text-[#16140c]">{broken}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <RefreshButton />
            <span className="font-mono text-[11px] uppercase tracking-wider text-mute">RH · SOL · BASE · BSC · ETH · MON</span>
          </div>
        </div>
        <div className="mx-auto max-w-7xl space-y-2 px-4 pb-2">
          <SourceDots />
          <GmgnTrackIngestBar />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 max-w-2xl text-sm text-mute">{subtitle}</p> : null}
          </div>
        </div>
        {children}
      </main>
      <footer className="mx-auto max-w-7xl px-4 pb-10 text-xs text-mute">
        Yeşil nokta = kaynak geldi. Kırmızı = denendi gelmedi. Gri = bu turda yok.
      </footer>
    </div>
  );
}
