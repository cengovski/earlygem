"use client";

import { RadarProvider } from "@/components/RadarProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return <RadarProvider>{children}</RadarProvider>;
}
