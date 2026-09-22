/** Browser Ed25519 pair — same flow as `npx gmgn-cli config`. */

export type GmgnKeyPair = {
  privatePem: string;
  publicPem: string;
  createUrl: string;
};

function toPem(der: ArrayBuffer, label: "PRIVATE KEY" | "PUBLIC KEY") {
  const bytes = new Uint8Array(der);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  const lines = b64.match(/.{1,64}/g)?.join("\n") ?? b64;
  return `-----BEGIN ${label}-----\n${lines}\n-----END ${label}-----`;
}

export function gmgnCreateApiUrl(publicPem: string) {
  const pem = publicPem.trim().endsWith("\n") ? publicPem.trim() : `${publicPem.trim()}\n`;
  return `https://gmgn.ai/ai/generateapi?pbk=${encodeURIComponent(pem)}`;
}

export async function generateGmgnEd25519(): Promise<GmgnKeyPair> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" } as AlgorithmIdentifier, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const privatePem = toPem(await crypto.subtle.exportKey("pkcs8", pair.privateKey), "PRIVATE KEY");
  const publicPem = toPem(await crypto.subtle.exportKey("spki", pair.publicKey), "PUBLIC KEY");
  return { privatePem, publicPem, createUrl: gmgnCreateApiUrl(publicPem) };
}
