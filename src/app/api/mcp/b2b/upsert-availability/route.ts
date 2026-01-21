import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/infra/db/prisma";
import { requireMcpToken } from "@/server/mcp/auth";

const RuleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMin: z.number().int().min(0).max(24 * 60),
  endMin: z.number().int().min(0).max(24 * 60),
});

const Schema = z.object({
  businessId: z.string().min(1),
  rules: z.array(RuleSchema).min(1),
});

export async function POST(request: Request) {
  const auth = requireMcpToken(request, "MCP_B2B_TOKEN");
  if (auth) return auth;

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, data: null, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { businessId, rules } = parsed.data;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json(
      { success: false, data: null, error: "Business not found" },
      { status: 404 },
    );
  }

  // Replace strategy (simple): delete all rules, then insert.
  await prisma.availabilityRule.deleteMany({ where: { businessId } });
  await prisma.availabilityRule.createMany({
    data: rules.map((r) => ({
      businessId,
      weekday: r.weekday,
      startMin: r.startMin,
      endMin: r.endMin,
    })),
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_UPSERT_AVAILABILITY",
      domain: "B2B",
      businessId,
      payload: { count: rules.length },
    },
  });

  return NextResponse.json(
    { success: true, data: { count: rules.length }, error: null },
    { status: 200 },
  );
}


