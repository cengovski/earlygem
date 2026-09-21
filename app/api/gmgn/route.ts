import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const HOST = "https://openapi.gmgn.ai";
const ALLOW = new Set([
  "/v1/user/kol",
  "/v1/user/smartmoney",
  "/v1/user/wallet_activity",
  "/v1/token/security",
  "/v1/token/info",
]);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "";
  if (!ALLOW.has(path)) {
    return NextResponse.json({ error: "path" }, { status: 400 });
  }
  const key = (req.headers.get("x-eg-gmgn") || "").trim();
  if (!key) {
    return NextResponse.json({ error: "key" }, { status: 401 });
  }
  const params = new URLSearchParams(url.searchParams);
  params.delete("path");
  const dest = `${HOST}${path}?${params.toString()}`;
  try {
    const res = await fetch(dest, {
      headers: { "X-APIKEY": key, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "fail" }, { status: 502 });
  }
}
