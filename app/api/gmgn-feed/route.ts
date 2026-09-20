import { NextResponse } from "next/server";
import { fetchExternalFeeds } from "@/lib/feeds";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";
export const maxDuration = 30;

export async function GET() {
  const out = await fetchExternalFeeds();
  return NextResponse.json({
    fills: out.fills.slice(0, 200),
    traders: out.traders.slice(0, 80),
  });
}
