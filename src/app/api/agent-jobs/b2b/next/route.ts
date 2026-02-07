import { NextResponse } from "next/server";
import { requireAgentJobsToken } from "@/server/agent-jobs/auth";
import { claimNextB2BJob } from "@/server/agent-jobs/b2b";

export async function GET(request: Request) {
  const auth = requireAgentJobsToken(request);
  if (auth) return auth;

  const url = new URL(request.url);
  const lockedBy = url.searchParams.get("lockedBy") || "unknown";

  const job = await claimNextB2BJob({ lockedBy });
  return NextResponse.json(
    { success: true, data: { job }, error: null },
    { status: 200 },
  );
}


