import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMcpToken } from "@/server/mcp/auth";
import { b2bGetContext } from "@/server/domains/b2b/tools";

const Schema = z
  .object({
    conversationId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
    meiWaId: z.preprocess(
      (v) => (v === "" ? undefined : v),
      z.string().min(1).optional(),
    ),
  })
  .refine((v) => Boolean(v.conversationId || v.meiWaId), {
    message: "Provide conversationId or meiWaId",
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

  const out = await b2bGetContext(parsed.data);
  return NextResponse.json({ success: true, data: out, error: null }, { status: 200 });
}


