import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/infra/db/prisma";
import { requireMcpToken } from "@/server/mcp/auth";

const Schema = z.object({
  businessId: z.string().min(1),
  meiWaId: z.string().min(1),
  text: z.string().min(1),
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

  const { businessId, meiWaId, text } = parsed.data;

  // MVP: we don't send WhatsApp messages yet; we just audit the "intent to reply".
  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_REPLY_TO_MEI_REQUESTED",
      domain: "B2B",
      businessId,
      payload: { meiWaId, text },
    },
  });

  return NextResponse.json(
    { success: true, data: { sent: false }, error: null },
    { status: 200 },
  );
}


