import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  businessCreate: vi.fn(async () => ({ id: "b1" })),
  meiUpsert: vi.fn(async () => ({})),
  conversationFindUnique: vi.fn(async () => ({ stageB2B: "SALES_DIAGNOSIS" })),
  conversationUpsert: vi.fn(async () => ({ id: "c1", phoneNumberId: "pn1" })),
  conversationCreate: vi.fn(async () => ({ id: "c2", phoneNumberId: "pn1" })),
  auditCreate: vi.fn(async () => ({})),
}));

vi.mock("@/server/infra/db/prisma", () => ({
  prisma: {
    business: { create: prismaMocks.businessCreate },
    meiContact: { upsert: prismaMocks.meiUpsert },
    conversation: {
      findUnique: prismaMocks.conversationFindUnique,
      upsert: prismaMocks.conversationUpsert,
      create: prismaMocks.conversationCreate,
    },
    auditEvent: { create: prismaMocks.auditCreate },
  },
}));

import { POST } from "@/app/api/mcp/b2b/create-business/route";

describe("/api/mcp/b2b/create-business", () => {
  beforeEach(() => {
    process.env.MCP_B2B_TOKEN = "tok";
    prismaMocks.auditCreate.mockClear();
    prismaMocks.conversationUpsert.mockClear();
    prismaMocks.conversationCreate.mockClear();
  });

  it("sets stageB2B=ONBOARDING_ASSISTED when creating business with conversationId", async () => {
    const req = new Request("http://localhost/api/mcp/b2b/create-business", {
      method: "POST",
      headers: { "x-mcp-token": "tok", "content-type": "application/json" },
      body: JSON.stringify({ meiWaId: "55", conversationId: "c1" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(prismaMocks.conversationUpsert).toHaveBeenCalled();
    const upsertArg = prismaMocks.conversationUpsert.mock.calls[0][0];
    expect(upsertArg.create.stageB2B).toBe("ONBOARDING_ASSISTED");
    expect(upsertArg.update.stageB2B).toBe("ONBOARDING_ASSISTED");
    expect(prismaMocks.auditCreate).toHaveBeenCalled();
  });
});


