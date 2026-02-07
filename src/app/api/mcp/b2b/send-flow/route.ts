import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMcpToken } from "@/server/mcp/auth";
import { b2bSendFlow } from "@/server/domains/b2b/tools";

const Schema = z.object({
  businessId: z.string().min(1),
  meiWaId: z.string().min(1),
  bodyText: z.string().min(1),
  flowId: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  flowToken: z.string().min(1),
  flowCta: z.string().min(1),
  screen: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(1).optional()),
  data: z.record(z.unknown()).optional(),
  conversationId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  phoneNumberId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
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

  const out = await b2bSendFlow(parsed.data);
  return NextResponse.json({ success: true, data: out, error: null }, { status: 200 });
}


