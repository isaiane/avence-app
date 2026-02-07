import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  conversationFindUnique: vi.fn(async () => ({ id: "c1", businessId: null, phoneNumberId: "pn1", fromWaId: "55" })),
  conversationUpdate: vi.fn(async () => ({ id: "c1", stageB2B: "SALES_RECEPTION", stateB2B: "ONBOARDING", businessId: null, phoneNumberId: "pn1" })),
  conversationUpsert: vi.fn(async () => ({ id: "c1", businessId: null, phoneNumberId: "pn1", fromWaId: "55" })),
  conversationCreate: vi.fn(async () => ({ id: "c1", businessId: null, phoneNumberId: "pn1", fromWaId: "55" })),
  auditCreate: vi.fn(async () => ({})),
}));

vi.mock("@/server/infra/db/prisma", () => ({
  prisma: {
    conversation: {
      findUnique: prismaMocks.conversationFindUnique,
      update: prismaMocks.conversationUpdate,
      upsert: prismaMocks.conversationUpsert,
      create: prismaMocks.conversationCreate,
    },
    auditEvent: { create: prismaMocks.auditCreate },
  },
}));

import { POST } from "@/app/api/mcp/b2b/set-stage/route";

describe("/api/mcp/b2b/set-stage", () => {
  beforeEach(() => {
    prismaMocks.conversationFindUnique.mockClear();
    prismaMocks.conversationUpdate.mockClear();
    prismaMocks.conversationUpsert.mockClear();
    prismaMocks.conversationCreate.mockClear();
    prismaMocks.auditCreate.mockClear();
    process.env.MCP_B2B_TOKEN = "tok";
  });

  it("updates stage for an existing conversation", async () => {
    const req = new Request("http://localhost/api/mcp/b2b/set-stage", {
      method: "POST",
      headers: { "x-mcp-token": "tok", "content-type": "application/json" },
      body: JSON.stringify({ stage: "SALES_DIAGNOSIS", conversationId: "c1", reason: "interest" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMocks.conversationUpdate).toHaveBeenCalled();
    expect(prismaMocks.auditCreate).toHaveBeenCalled();
  });
});


