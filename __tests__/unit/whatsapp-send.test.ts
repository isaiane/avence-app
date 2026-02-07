import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sendWhatsAppTextMessage } from "@/server/infra/whatsapp/send-text";

describe("sendWhatsAppTextMessage", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("sends a text message and returns providerMessageId", async () => {
    process.env.WHATSAPP_ACCESS_TOKEN = "token";
    process.env.WHATSAPP_API_VERSION = "v21.0";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ messages: [{ id: "wamid.123" }] }),
    });
    // @ts-expect-error test shim
    global.fetch = fetchMock;

    const out = await sendWhatsAppTextMessage({
      phoneNumberId: "123456",
      toWaId: "5511999999999",
      text: "hello",
    });

    expect(out).toEqual({ providerMessageId: "wamid.123" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("https://graph.facebook.com/v21.0/123456/messages");
    expect(opts.method).toBe("POST");
  });

  it("throws if access token is missing", async () => {
    // @ts-expect-error test shim
    global.fetch = vi.fn();
    await expect(
      sendWhatsAppTextMessage({
        phoneNumberId: "1",
        toWaId: "2",
        text: "x",
      }),
    ).rejects.toThrow("WHATSAPP_ACCESS_TOKEN");
  });
});


