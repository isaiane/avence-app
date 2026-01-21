import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/infra/db/prisma";

const SeedSchema = z.object({
  phoneNumberId: z.string().min(1),
  domain: z.enum(["B2B", "B2C"]),
  businessId: z.string().min(1).optional(),
  businessName: z.string().min(1).optional(),
});

function unauthorized() {
  return NextResponse.json(
    { success: false, data: null, error: "Unauthorized" },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const expected = process.env.ADMIN_SEED_TOKEN;
  const provided = request.headers.get("x-admin-seed-token");
  if (!expected || !provided || provided !== expected) {
    return unauthorized();
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, data: null, error: "Invalid JSON" },
      { status: 400 },
    );
  }

  const parsed = SeedSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, data: null, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { phoneNumberId, domain, businessId, businessName } = parsed.data;

  if (domain === "B2C" && !businessId) {
    return NextResponse.json(
      { success: false, data: null, error: "businessId is required for B2C" },
      { status: 400 },
    );
  }

  if (businessId) {
    await prisma.business.upsert({
      where: { id: businessId },
      create: { id: businessId, name: businessName },
      update: { name: businessName },
    });
  }

  const route = await prisma.phoneNumberRoute.upsert({
    where: { phoneNumberId },
    create: {
      phoneNumberId,
      domain,
      businessId: domain === "B2C" ? businessId : null,
    },
    update: {
      domain,
      businessId: domain === "B2C" ? businessId : null,
    },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "ADMIN_SEED_PHONE_ROUTE",
      domain,
      businessId: route.businessId ?? undefined,
      phoneNumberId,
      payload: { phoneNumberId, domain, businessId: route.businessId ?? null },
    },
  });

  return NextResponse.json(
    { success: true, data: { route }, error: null },
    { status: 200 },
  );
}


