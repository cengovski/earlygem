import { NextResponse } from "next/server";

export function requireSecret(req: Request) {
  const secret = process.env.CRON_SECRET || process.env.APP_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
