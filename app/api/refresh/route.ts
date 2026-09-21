import { revalidatePath } from "next/cache";
import { requireSecret } from "@/lib/auth";
import { logEvent } from "@/lib/log";
import { bustRadarCache } from "@/lib/radar";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST(req: Request) {
  const denied = requireSecret(req);
  if (denied) return denied;
  bustRadarCache();
  revalidatePath("/", "layout");
  logEvent({ level: "info", event: "manual_refresh", outcome: "ok" });
  return NextResponse.json({ ok: true, ts: Date.now() });
}
