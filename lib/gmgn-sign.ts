/** GMGN signed auth: `{path}:{sorted_qs}:{body}:{timestamp}` then Ed25519 or RSA-PSS. */

function pemDer(pem: string) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

function toB64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function looksEd25519(pem: string) {
  return /ED25519/i.test(pem) || pem.replace(/\s+/g, "").length < 600;
}

export function gmgnAuthQuery() {
  return {
    timestamp: String(Math.floor(Date.now() / 1000)),
    client_id: crypto.randomUUID(),
  };
}

export function gmgnSignMessage(path: string, query: Record<string, string>, body: string, timestamp: string) {
  const qs = Object.keys(query)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");
  return `${path}:${qs}:${body}:${timestamp}`;
}

async function importPem(pem: string): Promise<{ key: CryptoKey; pss: boolean }> {
  const der = pemDer(pem);
  if (looksEd25519(pem)) {
    try {
      const key = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, false, ["sign"]);
      return { key, pss: false };
    } catch {
      /* fall through to RSA */
    }
  }
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSA-PSS", hash: "SHA-256" }, false, ["sign"]);
  return { key, pss: true };
}

export async function gmgnSign(pem: string, message: string) {
  const { key, pss } = await importPem(pem.trim());
  const bytes = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign(pss ? { name: "RSA-PSS", saltLength: 32 } : { name: "Ed25519" }, key, bytes);
  return toB64(sig);
}
