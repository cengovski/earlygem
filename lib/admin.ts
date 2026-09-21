const COOKIE = "eg_admin";
const MAX_AGE = 7 * 24 * 60 * 60;

function secret() {
  return process.env.ADMIN_PASSWORD || "";
}

function signKey() {
  return process.env.CRON_SECRET || process.env.APP_SECRET || secret();
}

export function adminConfigured() {
  return Boolean(secret());
}

function toHex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(text: string) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(signKey()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const buf = await crypto.subtle.sign("HMAC", key, enc.encode(text));
  return toHex(buf);
}

function safeEq(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

export function checkPassword(pass: string) {
  const want = secret();
  if (!want || !pass) return false;
  return safeEq(pass, want);
}

export async function makeSession() {
  const exp = Date.now() + MAX_AGE * 1000;
  const payload = String(exp);
  const sig = await hmac(payload);
  return { cookie: `${COOKIE}=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${MAX_AGE}`, exp };
}

export function clearSession() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export async function sessionOk(req: Request) {
  const raw = req.headers.get("cookie") || "";
  const hit = raw.split(";").map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  if (!hit) return false;
  const value = hit.slice(COOKIE.length + 1);
  const dot = value.indexOf(".");
  if (dot < 0) return false;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const exp = Number(payload);
  if (!exp || Date.now() > exp) return false;
  const expect = await hmac(payload);
  return safeEq(sig, expect);
}
