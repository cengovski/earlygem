import { listGmgnIngest, pushGmgnIngest } from "@/lib/gmgn-ingest-store";
import { parseGmgnTrackFills } from "@/lib/gmgn-bridge";

const ALLOW = new Set(["https://gmgn.ai", "https://www.gmgn.ai", "https://app.gmgn.ai"]);

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Private-Network": "true",
    "Access-Control-Max-Age": "86400",
  };
  if (ALLOW.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

export function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: cors(req) });
}

export async function POST(req: Request) {
  const headers = cors(req);
  try {
    const body = await req.json();
    const fills = parseGmgnTrackFills(body).filter((row) => String(row.side || "").toLowerCase() === "buy");
    const count = pushGmgnIngest(fills);
    return Response.json({ ok: true, count }, { headers });
  } catch {
    return Response.json({ ok: false, error: "json" }, { status: 400, headers });
  }
}

export async function GET(req: Request) {
  const headers = cors(req);
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") || 0) || Date.now() - 20 * 60_000;
  const fills = listGmgnIngest(since);
  return Response.json({ ok: true, fills, until: Date.now() }, { headers });
}
