import { NextResponse } from "next/server";

export function requireMcpToken(request: Request, envVarName: string) {
  const expected = process.env[envVarName];
  const provided = request.headers.get("x-mcp-token");

  if (!expected || !provided || provided !== expected) {
    return NextResponse.json(
      { success: false, data: null, error: "Unauthorized" },
      { status: 401 },
    );
  }

  return null;
}


