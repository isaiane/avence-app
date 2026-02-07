import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMcpToken } from "@/server/mcp/auth";
import { b2bSetStage } from "@/server/domains/b2b/tools";

const StageEnum = z.enum([
  "SALES_RECEPTION",
  "SALES_DIAGNOSIS",
  "ONBOARDING_ASSISTED",
  "ONBOARDING_COMPLETED",
  "WAITING",
  "HANDOFF_HUMAN",
]);

const Schema = z.object({
  stage: StageEnum,
  reason: z.string().min(1).optional(),
  conversationId: z.preprocess(
    (v) => (v === "" ? undefined : v),
    z.string().min(1).optional(),
  ),
  meiWaId: z.preprocess(
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

  const out = await b2bSetStage(parsed.data);
  return NextResponse.json({ success: true, data: out, error: null }, { status: 200 });
}


