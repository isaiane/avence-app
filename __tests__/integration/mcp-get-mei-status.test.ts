import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMocks = vi.hoisted(() => ({
  meiFindUnique: vi.fn(async () => null),
  businessFindUnique: vi.fn(async () => null),
  conversationFindUnique: vi.fn(async () => null),
  conversationFindFirst: vi.fn(async () => null),
  auditCreate: vi.fn(async () => ({})),
}));

vi.mock("@/server/infra/db/prisma", () => ({
  prisma: {
    meiContact: { findUnique: prismaMocks.meiFindUnique },
    business: { findUnique: prismaMocks.businessFindUnique },
    conversation: {
      findUnique: prismaMocks.conversationFindUnique,
      findFirst: prismaMocks.conversationFindFirst,
    },
    auditEvent: { create: prismaMocks.auditCreate },
  },
}));

import { POST } from "@/app/api/mcp/b2b/get-mei-status/route";

describe("/api/mcp/b2b/get-mei-status", () => {
  beforeEach(() => {
    prismaMocks.meiFindUnique.mockClear();
    prismaMocks.businessFindUnique.mockClear();
    prismaMocks.conversationFindUnique.mockClear();
    prismaMocks.conversationFindFirst.mockClear();
    prismaMocks.auditCreate.mockClear();
    process.env.MCP_B2B_TOKEN = "tok";
  });

  it("returns isCustomer=false when MEI not found", async () => {
    const req = new Request("http://localhost/api/mcp/b2b/get-mei-status", {
      method: "POST",
      headers: { "x-mcp-token": "tok", "content-type": "application/json" },
      body: JSON.stringify({ meiWaId: "5511999999999" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.isCustomer).toBe(false);
    expect(json.data.activeStage).toBeTruthy();
    expect(prismaMocks.auditCreate).toHaveBeenCalled();
  });

  it("accepts empty strings for optional ids (treated as undefined)", async () => {
    const req = new Request("http://localhost/api/mcp/b2b/get-mei-status", {
      method: "POST",
      headers: { "x-mcp-token": "tok", "content-type": "application/json" },
      body: JSON.stringify({ meiWaId: "5511999999999", conversationId: "", phoneNumberId: "" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it("returns business context when MEI is a customer", async () => {
    prismaMocks.meiFindUnique.mockResolvedValueOnce({
      waId: "5511999999999",
      displayName: "MEI",
      businessId: "b1",
    });
    prismaMocks.businessFindUnique.mockResolvedValueOnce({
      id: "b1",
      name: "Biz",
      plan: "START",
    });

    const req = new Request("http://localhost/api/mcp/b2b/get-mei-status", {
      method: "POST",
      headers: { "x-mcp-token": "tok", "content-type": "application/json" },
      body: JSON.stringify({ meiWaId: "5511999999999" }),
    });

    const res = await POST(req);
    const json = await res.json();
    expect(json.data.isCustomer).toBe(true);
    expect(json.data.business).toEqual({ id: "b1", name: "Biz", plan: "START" });
  });
});


