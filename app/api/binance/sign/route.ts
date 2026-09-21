import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Signing happens in the browser with admin localStorage keys. Never leak server tickets. */
export async function GET() {
  return NextResponse.json({ error: "gone", hint: "sign in browser" }, { status: 410 });
}
