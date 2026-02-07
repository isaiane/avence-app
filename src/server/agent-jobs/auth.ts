import { NextResponse } from "next/server";

export function requireAgentJobsToken(request: Request) {
  const expected = process.env.AGENT_JOBS_TOKEN;
  const provided = request.headers.get("x-agent-jobs-token");

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return null;
}


