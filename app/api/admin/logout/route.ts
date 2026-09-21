import { NextResponse } from "next/server";
import { clearSession } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", clearSession());
  return res;
}
