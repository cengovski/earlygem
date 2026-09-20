import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/log";
import { bustRadarCache } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function POST() {
  bustRadarCache();
  revalidatePath("/", "layout");
  logEvent({ level: "info", event: "manual_refresh", outcome: "ok" });
  return Response.json({ ok: true, ts: Date.now() });
}
