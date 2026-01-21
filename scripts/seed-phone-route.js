/**
 * Seed (upsert) do mapping phone_number_id → domain/businessId.
 *
 * Uso:
 *   PHONE_NUMBER_ID=... DOMAIN=B2C BUSINESS_ID=biz_test_1 BUSINESS_NAME="Business Teste" npm run seed:phone-route
 *
 * DOMAIN: B2B | B2C
 * BUSINESS_ID obrigatório para B2C.
 */

const { PrismaClient } = require("@prisma/client");

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

async function main() {
  // Ensure Prisma can connect (DATABASE_URL should be present)
  mustGetEnv("DATABASE_URL");

  const phoneNumberId = mustGetEnv("PHONE_NUMBER_ID");
  const domain = mustGetEnv("DOMAIN");
  const businessId = process.env.BUSINESS_ID;
  const businessName = process.env.BUSINESS_NAME;

  if (domain !== "B2B" && domain !== "B2C") {
    throw new Error("DOMAIN must be B2B or B2C");
  }

  if (domain === "B2C" && !businessId) {
    throw new Error("BUSINESS_ID is required when DOMAIN=B2C");
  }

  const prisma = new PrismaClient({ log: ["warn", "error"] });

  try {
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
        eventType: "SCRIPT_SEED_PHONE_ROUTE",
        domain,
        businessId: route.businessId ?? undefined,
        phoneNumberId,
        payload: { phoneNumberId, domain, businessId: route.businessId ?? null },
      },
    });

    console.log("Seed OK:", route);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


