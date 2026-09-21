import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** Feeds run in the user's browser. This server scrape is disabled. */
export async function GET() {
  return NextResponse.json({ error: "gone", hint: "client_only" }, { status: 410 });
}
