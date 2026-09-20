import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VPS = (process.env.PULSE_ORIGIN || "http://107.175.85.233:8787").replace(/\/$/, "");
const ALLOW = new Set(["status", "traders", "tape", "discover", "bags", "overview", "alive", "health"]);

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const head = path?.[0] || "";
  if (!ALLOW.has(head)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const src = new URL(req.url);
  const dest = `${VPS}/api/${path.join("/")}${src.search}`;
  try {
    const res = await fetch(dest, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    if (/just a moment|cf-browser-verification/i.test(text)) {
      return NextResponse.json({ error: "challenge" }, { status: 502 });
    }
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "fail" }, { status: 502 });
  }
}
