import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppFlowMessage } from "@/server/infra/whatsapp/send-flow";

describe("sendWhatsAppFlowMessage", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends an interactive flow message", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: "wamid.flow" }] }),
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    const out = await sendWhatsAppFlowMessage({
      phoneNumberId: "123456",
      toWaId: "5511999999999",
      bodyText: "Vamos configurar?",
      flowId: "flow_1",
      flowToken: "token_1",
      flowCta: "Abrir formulário",
      screen: "START",
      data: { foo: "bar" },
    });

    expect(out).toEqual({ providerMessageId: "wamid.flow" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


