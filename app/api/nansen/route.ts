import { NextResponse } from "next/server";
import { NANSEN_BODY } from "@/lib/nansen";

export const dynamic = "force-dynamic";

const UPSTREAM = "https://api.nansen.ai/api/v1/smart-money/dex-trades";

export async function POST(req: Request) {
  const key = (req.headers.get("x-eg-nansen") || "").trim();
  if (!key) return NextResponse.json({ error: "key" }, { status: 401 });
  const incoming = (await req.json().catch(() => null)) as { pagination?: { page?: number; per_page?: number } } | null;
  const page = Math.max(1, Math.floor(Number(incoming?.pagination?.page) || 1));
  const perPage = Math.min(1000, Math.max(1, Math.floor(Number(incoming?.pagination?.per_page) || 1000)));
  try {
    const res = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        apikey: key,
        Accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...NANSEN_BODY, pagination: { page, per_page: perPage } }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = { error: text.slice(0, 200) || res.statusText };
    }
    json.creditsRemaining = res.headers.get("x-nansen-credits-remaining");
    json.creditsUsed = res.headers.get("x-nansen-credits-used");
    return NextResponse.json(json, { status: res.status });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "fail" }, { status: 502 });
  }
}
