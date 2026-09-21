import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST() {
  return NextResponse.json({ error: "gone", hint: "telegram from browser" }, { status: 410 });
}
