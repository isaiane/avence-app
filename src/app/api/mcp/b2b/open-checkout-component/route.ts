import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMcpToken } from "@/server/mcp/auth";
import { b2bOpenCheckoutComponent } from "@/server/domains/b2b/tools";

const Schema = z.object({
  businessId: z.string().min(1),
  meiWaId: z.string().min(1),
  conversationId: z.string().min(1),
  phoneNumberId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  plan: z.enum(["START", "PRO", "PAY"]).optional(),
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

  const out = await b2bOpenCheckoutComponent(parsed.data);
  return NextResponse.json({ success: true, data: out, error: null }, { status: 200 });
}



