import type { AlertHit } from "./alert-msg";
import { honeypotTelegramLine, scanHoneypot } from "./honeypot";

export async function attachHoneypot(hit: AlertHit): Promise<AlertHit> {
  const scan = await scanHoneypot(hit.chain, hit.token);
  return {
    ...hit,
    honeypot: scan.honeypot,
    honeypotLine: honeypotTelegramLine(scan),
  };
}
