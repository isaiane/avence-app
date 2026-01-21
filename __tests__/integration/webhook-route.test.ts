import crypto from "crypto";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks must be declared before importing the route module.
const prismaMocks = vi.hoisted(() => ({
  auditCreate: vi.fn(async () => ({})),
  inboundCreate: vi.fn(async () => ({})),
}));

vi.mock("@/server/infra/db/prisma", () => ({
  prisma: {
    auditEvent: { create: prismaMocks.auditCreate },
    inboundMessage: { create: prismaMocks.inboundCreate },
  },
}));

const routingMocks = vi.hoisted(() => ({
  resolveDomainByPhoneNumberId: vi.fn(async () => ({ domain: "B2B", businessId: null })),
}));

vi.mock("@/server/routing/resolve-domain", () => ({
  resolveDomainByPhoneNumberId: routingMocks.resolveDomainByPhoneNumberId,
}));

import { GET, POST } from "@/app/api/webhooks/whatsapp/route";

function sign(secret: string, rawBody: Buffer) {
  return `sha256=${crypto.createHmac("sha256", secret).update(rawBody).digest("hex")}`;
}

describe("/api/webhooks/whatsapp route", () => {
  beforeEach(() => {
    prismaMocks.auditCreate.mockClear();
    prismaMocks.inboundCreate.mockClear();
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "token";
    process.env.WHATSAPP_APP_SECRET = "secret";
    process.env.AVENCE_PHONE_NUMBER_ID = "";
  });

  it("GET returns 200 with challenge when verify token matches", async () => {
    const req = new Request(
      "http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token&hub.challenge=123",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("123");
  });

  it("POST returns 401 on invalid signature", async () => {
    const body = Buffer.from(JSON.stringify({ foo: "bar" }), "utf8");
    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=deadbeef" },
      body,
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("POST statuses (no messages) is accepted and creates WHATSAPP_WEBHOOK_STATUS audit event", async () => {
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

    const raw = Buffer.from(JSON.stringify(payload), "utf8");
    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "x-hub-signature-256": sign("secret", raw) },
      body: raw,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(prismaMocks.auditCreate).toHaveBeenCalled();
    const call = prismaMocks.auditCreate.mock.calls.find(
      (c) => c?.[0]?.data?.eventType === "WHATSAPP_WEBHOOK_STATUS",
    );
    expect(call).toBeTruthy();
  });
});


