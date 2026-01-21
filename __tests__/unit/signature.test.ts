import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { verifyWhatsAppSignature } from "@/server/entrypoints/whatsapp/signature";

describe("verifyWhatsAppSignature", () => {
  it("accepts a valid sha256 signature", () => {
    const secret = "test_secret";
    const rawBody = Buffer.from('{"hello":"world"}', "utf8");
    const sig = `sha256=${crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex")}`;

    const res = verifyWhatsAppSignature({
      rawBody,
      signatureHeader: sig,
      appSecret: secret,
    });

    expect(res).toEqual({ ok: true });
  });

  it("rejects an invalid signature", () => {
    const res = verifyWhatsAppSignature({
      rawBody: Buffer.from("x"),
      signatureHeader: "sha256=deadbeef",
      appSecret: "secret",
    });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("Invalid signature");
  });
});


