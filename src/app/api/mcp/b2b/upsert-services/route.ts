import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/infra/db/prisma";
import { requireMcpToken } from "@/server/mcp/auth";

const ServiceSchema = z.object({
  name: z.string().min(1),
  priceCents: z.number().int().nonnegative().optional(),
  durationMin: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

const Schema = z.object({
  businessId: z.string().min(1),
  services: z.array(ServiceSchema).min(1),
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

  const { businessId, services } = parsed.data;

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json(
      { success: false, data: null, error: "Business not found" },
      { status: 404 },
    );
  }

  for (const s of services) {
    await prisma.service.upsert({
      where: { businessId_name: { businessId, name: s.name } },
      create: {
        businessId,
        name: s.name,
        priceCents: s.priceCents,
        durationMin: s.durationMin,
        active: s.active ?? true,
      },
      update: {
        priceCents: s.priceCents,
        durationMin: s.durationMin,
        active: s.active ?? true,
      },
    });
  }

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_UPSERT_SERVICES",
      domain: "B2B",
      businessId,
      payload: { count: services.length },
    },
  });

  return NextResponse.json(
    { success: true, data: { count: services.length }, error: null },
    { status: 200 },
  );
}


