import { runB2BAgentStub } from "@/server/agent/b2b/run-b2b-agent.stub";

export async function runB2BAgent(params: {
  phoneNumberId: string;
  conversationId: string;
  meiWaId: string;
  text: string | undefined;
}) {
  const runtime = (process.env.B2B_AGENT_RUNTIME ?? "stub").toLowerCase();

  if (runtime === "agentkit") {
    const { runB2BAgentWithAgentKit } = await import(
      "@/server/agent/b2b/run-b2b-agent.agentkit"
    );
    return await runB2BAgentWithAgentKit(params);
  }

  return await runB2BAgentStub(params);
}


