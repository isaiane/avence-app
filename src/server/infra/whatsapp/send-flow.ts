type SendWhatsAppFlowParams = {
  phoneNumberId: string;
  toWaId: string;
  bodyText: string;
  flowId: string;
  flowToken: string;
  flowCta: string;
  screen?: string;
  data?: Record<string, unknown>;
};

type SendWhatsAppFlowResult = {
  providerMessageId: string;
};

export async function sendWhatsAppFlowMessage(
  params: SendWhatsAppFlowParams,
): Promise<SendWhatsAppFlowResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Missing env WHATSAPP_ACCESS_TOKEN");

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";
  const { phoneNumberId, toWaId, bodyText, flowId, flowToken, flowCta, screen, data } =
    params;

  if (!phoneNumberId) throw new Error("Missing phoneNumberId for WhatsApp send.");
  if (!toWaId) throw new Error("Missing toWaId for WhatsApp send.");
  if (!flowId) throw new Error("Missing flowId for WhatsApp flow send.");
  if (!flowToken) throw new Error("Missing flowToken for WhatsApp flow send.");
  if (!flowCta) throw new Error("Missing flowCta for WhatsApp flow send.");
  if (!bodyText) throw new Error("Missing bodyText for WhatsApp flow send.");

  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(
    phoneNumberId,
  )}/messages`;

  // Payload follows WhatsApp "interactive flow" shape.
  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWaId,
      type: "interactive",
      interactive: {
        type: "flow",
        body: { text: bodyText },
        action: {
          name: "flow",
          parameters: {
            flow_message_version: "3",
            flow_id: flowId,
            flow_token: flowToken,
            flow_cta: flowCta,
            flow_action: "navigate",
            flow_action_payload: {
              screen: screen || "START",
              data: data || {},
            },
          },
        },
      },
    }),
  });

  const raw = await res.text();
  let json: any = null;
  try {
    json = raw ? JSON.parse(raw) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    throw new Error(
      `WhatsApp flow send failed (${res.status}): ${raw.slice(0, 500) || "<empty>"}`,
    );
  }

  const providerMessageId: string | undefined = json?.messages?.[0]?.id;
  if (!providerMessageId) {
    throw new Error(
      `WhatsApp flow send succeeded but missing messages[0].id: ${raw.slice(0, 500)}`,
    );
  }

  return { providerMessageId };
}


