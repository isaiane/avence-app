import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/infra/db/prisma";
import { requireMcpToken } from "@/server/mcp/auth";

const Schema = z.object({
  meiWaId: z.string().min(1),
  businessName: z.string().min(1).optional(),
  meiDisplayName: z.string().min(1).optional(),
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

  const { meiWaId, businessName, meiDisplayName } = parsed.data;

  const business = await prisma.business.create({
    data: { name: businessName },
  });

  await prisma.meiContact.upsert({
    where: { waId: meiWaId },
    create: { waId: meiWaId, displayName: meiDisplayName, businessId: business.id },
    update: { displayName: meiDisplayName, businessId: business.id },
  });

  await prisma.conversation.create({
    data: {
      domain: "B2B",
      stateB2B: "ONBOARDING",
      businessId: business.id,
      fromWaId: meiWaId,
    },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_CREATE_BUSINESS",
      domain: "B2B",
      businessId: business.id,
      payload: { meiWaId },
    },
  });

  return NextResponse.json(
    { success: true, data: { businessId: business.id }, error: null },
    { status: 200 },
  );
}


