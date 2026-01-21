import { NextResponse } from "next/server";
import { prisma } from "@/server/infra/db/prisma";

function unauthorized() {
  return NextResponse.json(
    { success: false, data: null, error: "Unauthorized" },
    { status: 401 },
  );
}

export async function GET(request: Request) {
  const expected = process.env.ADMIN_SEED_TOKEN;
  const provided = request.headers.get("x-admin-seed-token");
  if (!expected || !provided || provided !== expected) {
    return unauthorized();
  }

  try {
    const url = new URL(request.url);
    const limit = Math.min(
      Number(url.searchParams.get("limit") ?? 20) || 20,
      100,
    );

    const [events, inboundMessages, routes] = await Promise.all([
      prisma.auditEvent.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.inboundMessage.findMany({
        orderBy: { receivedAt: "desc" },
        take: limit,
      }),
      prisma.phoneNumberRoute.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: { events, inboundMessages, routes },
        error: null,
      },
      { status: 200 },
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        data: null,
        error: {
          message: String(e?.message ?? e),
          hint:
            "Verifique DATABASE_URL, se o database existe (ex.: createdb ...) e se as migrações Prisma já rodaram.",
        },
      },
      { status: 500 },
    );
  }
}


