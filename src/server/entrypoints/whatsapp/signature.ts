import crypto from "crypto";

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export function verifyWhatsAppSignature(params: {
  rawBody: Buffer;
  signatureHeader: string | null;
  appSecret: string | undefined;
}): { ok: true } | { ok: false; reason: string } {
  const { rawBody, signatureHeader, appSecret } = params;
  if (!appSecret) {
    return { ok: false, reason: "Missing WHATSAPP_APP_SECRET" };
  }

  if (!signatureHeader) {
    return { ok: false, reason: "Missing X-Hub-Signature-256 header" };
  }

  // Meta sends "sha256=<hex>"
  const expected = `sha256=${crypto
    .createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;

  if (!safeEqual(signatureHeader, expected)) {
    return { ok: false, reason: "Invalid signature" };
  }

  return { ok: true };
}


