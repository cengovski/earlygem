import { NextResponse } from "next/server";
import { sessionOk } from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return NextResponse.json({ ok: await sessionOk(req) });
}
