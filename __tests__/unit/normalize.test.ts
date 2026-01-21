import { describe, expect, it } from "vitest";
import { normalizeWhatsAppWebhookPayload } from "@/server/entrypoints/whatsapp/normalize";

describe("normalizeWhatsAppWebhookPayload", () => {
  it("extracts phone_number_id and message ids", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pnid_1" },
                messages: [
                  { id: "wamid.1", from: "5511999999999", type: "text", text: { body: "oi" }, timestamp: "1" },
                ],
              },
            },
          ],
        },
      ],
    };

    const out = normalizeWhatsAppWebhookPayload(payload);
    expect(out).toHaveLength(1);
    expect(out[0].phoneNumberId).toBe("pnid_1");
    expect(out[0].providerMessageId).toBe("wamid.1");
    expect(out[0].textBody).toBe("oi");
  });

  it("returns [] when payload has no messages (e.g. statuses)", () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "pnid_1" },
                statuses: [{ id: "wamid.1", status: "delivered" }],
              },
            },
          ],
        },
      ],
    };

    expect(normalizeWhatsAppWebhookPayload(payload)).toEqual([]);
  });
});


