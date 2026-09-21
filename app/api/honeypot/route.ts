import { NextResponse } from "next/server";
import { scanHoneypotDirect } from "@/lib/honeypot";
import type { ChainId } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHAINS: ChainId[] = ["robinhood", "solana", "base", "bsc", "ethereum", "monad"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const chain = url.searchParams.get("chain") as ChainId | null;
  const token = url.searchParams.get("token") || "";
  if (!chain || !CHAINS.includes(chain) || token.length < 32) {
    return NextResponse.json({ honeypot: null, sources: [], reasons: [] });
  }
  const scan = await scanHoneypotDirect(chain, token);
  return NextResponse.json(scan);
}
