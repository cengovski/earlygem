import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const rule = await loadSettings();
  return NextResponse.json(rule);
}
