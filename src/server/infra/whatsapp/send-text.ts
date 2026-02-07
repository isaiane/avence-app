type SendWhatsAppTextParams = {
  phoneNumberId: string;
  toWaId: string;
  text: string;
};

type SendWhatsAppTextResult = {
  providerMessageId: string;
};

export async function sendWhatsAppTextMessage(
  params: SendWhatsAppTextParams,
): Promise<SendWhatsAppTextResult> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) throw new Error("Missing env WHATSAPP_ACCESS_TOKEN");

  const apiVersion = process.env.WHATSAPP_API_VERSION || "v21.0";
  const { phoneNumberId, toWaId, text } = params;

  if (!phoneNumberId) throw new Error("Missing phoneNumberId for WhatsApp send.");
  if (!toWaId) throw new Error("Missing toWaId for WhatsApp send.");
  if (!text) throw new Error("Missing text for WhatsApp send.");

  const url = `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(
    phoneNumberId,
  )}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toWaId,
      type: "text",
      text: { body: text },
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
      `WhatsApp send failed (${res.status}): ${raw.slice(0, 500) || "<empty>"}`,
    );
  }

  const providerMessageId: string | undefined = json?.messages?.[0]?.id;
  if (!providerMessageId) {
    throw new Error(
      `WhatsApp send succeeded but missing messages[0].id: ${raw.slice(0, 500)}`,
    );
  }

  return { providerMessageId };
}


