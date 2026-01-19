import { prisma } from "@/server/infra/db/prisma";

export type ResolvedDomain =
  | { domain: "B2B"; businessId: null }
  | { domain: "B2C"; businessId: string }
  | { domain: "UNKNOWN"; businessId: null };

export async function resolveDomainByPhoneNumberId(
  phoneNumberId: string,
): Promise<ResolvedDomain> {
  const avencePhoneNumberId = process.env.AVENCE_PHONE_NUMBER_ID;
  if (avencePhoneNumberId && phoneNumberId === avencePhoneNumberId) {
    return { domain: "B2B", businessId: null };
  }

  const route = await prisma.phoneNumberRoute.findUnique({
    where: { phoneNumberId },
    select: { domain: true, businessId: true },
  });

  if (!route) {
    return { domain: "UNKNOWN", businessId: null };
  }

  if (route.domain === "B2B") {
    return { domain: "B2B", businessId: null };
  }

  if (!route.businessId) {
    return { domain: "UNKNOWN", businessId: null };
  }

  return { domain: "B2C", businessId: route.businessId };
}


