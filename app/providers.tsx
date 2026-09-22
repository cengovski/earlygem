"use client";

import { useEffect } from "react";
import { RadarProvider } from "@/components/RadarProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    window.name = "earlygem";
  }, []);
  return <RadarProvider>{children}</RadarProvider>;
}
