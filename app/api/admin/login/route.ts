import { NextResponse } from "next/server";
import { adminConfigured, checkPassword, makeSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!adminConfigured()) {
    return NextResponse.json({ ok: false, error: "ADMIN_PASSWORD yok" }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  if (!checkPassword(body?.password || "")) {
    return NextResponse.json({ ok: false, error: "hatali_sifre" }, { status: 401 });
  }
  const session = await makeSession();
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", session.cookie);
  return res;
}
