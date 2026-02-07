import { NextResponse } from "next/server";
import { requireAgentJobsToken } from "@/server/agent-jobs/auth";
import { completeB2BJob } from "@/server/agent-jobs/b2b";

export async function POST(request: Request, context: { params: { id: string } }) {
  const auth = requireAgentJobsToken(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const lockedBy = url.searchParams.get("lockedBy") || "unknown";
  const id = context.params.id;

  const job = await completeB2BJob({ id, lockedBy });
  return NextResponse.json({ success: true, data: { job }, error: null }, { status: 200 });
}


