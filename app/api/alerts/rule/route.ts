import { NextResponse } from "next/server";
import { serverRule } from "@/lib/watch";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(serverRule());
}
