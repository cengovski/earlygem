import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const VPS = (process.env.PULSE_ORIGIN || "").replace(/\/$/, "");
const ALLOW = new Set(["status", "traders", "tape", "discover", "bags", "overview", "alive", "health"]);

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  const head = path?.[0] || "";
  if (!ALLOW.has(head)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!VPS) return NextResponse.json({ error: "pulse_origin_yok" }, { status: 502 });
  const src = new URL(req.url);
  const dest = `${VPS}/api/${path.join("/")}${src.search}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  const gate = process.env.APP_SECRET || process.env.CRON_SECRET || "";
  if (gate) headers.Authorization = `Bearer ${gate}`;
  try {
    const res = await fetch(dest, {
      headers,
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
