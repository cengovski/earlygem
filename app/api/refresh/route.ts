import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/log";

export const dynamic = "force-dynamic";

export async function POST() {
  revalidatePath("/", "layout");
  logEvent({ level: "info", event: "manual_refresh", outcome: "ok" });
  return Response.json({ ok: true, ts: Date.now() });
}
