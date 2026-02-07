import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAgentJobsToken } from "@/server/agent-jobs/auth";
import { failB2BJob } from "@/server/agent-jobs/b2b";

const Schema = z.object({
  error: z.string().min(1),
});

export async function POST(request: Request, context: { params: { id: string } }) {
  const auth = requireAgentJobsToken(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const lockedBy = url.searchParams.get("lockedBy") || "unknown";
  const id = context.params.id;

  const body = await request.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, data: null, error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const job = await failB2BJob({ id, lockedBy, error: parsed.data.error });
  return NextResponse.json({ success: true, data: { job }, error: null }, { status: 200 });
}


