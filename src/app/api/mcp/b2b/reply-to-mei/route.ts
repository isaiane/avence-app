import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMcpToken } from "@/server/mcp/auth";
import { b2bReplyToMeiRequested } from "@/server/domains/b2b/tools";

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
  await b2bReplyToMeiRequested({ businessId, meiWaId, text });

  return NextResponse.json(
    { success: true, data: { sent: false }, error: null },
    { status: 200 },
  );
}


