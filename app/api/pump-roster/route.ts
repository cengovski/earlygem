import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const preferredRegion = "fra1";

const URL = "https://frontend-api-v3.pump.fun/users?offset=0&limit=25&sort=followers";

export async function GET() {
  try {
    const res = await fetch(URL, {
      headers: { Accept: "application/json", "User-Agent": "earlygem" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const json = await res.json().catch(() => null);
    return NextResponse.json(json ?? [], { status: res.ok ? 200 : 502 });
  } catch {
    return NextResponse.json([], { status: 502 });
  }
}
