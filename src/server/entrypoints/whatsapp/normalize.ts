export type NormalizedInboundMessage = {
  phoneNumberId: string;
  providerMessageId: string;
  fromWaId?: string;
  messageType?: string;
  textBody?: string;
  providerTimestamp?: string;
  raw: unknown;
};

// Minimal normalizer for WhatsApp Cloud API webhook payload.
// We only extract what we need for idempotency + routing by phone_number_id.
export function normalizeWhatsAppWebhookPayload(
  payload: any,
): NormalizedInboundMessage[] {
  const entry = payload?.entry?.[0];
  const change = entry?.changes?.[0];
  const value = change?.value;

  const phoneNumberId: string | undefined = value?.metadata?.phone_number_id;
  const messages: any[] | undefined = value?.messages;

  if (!phoneNumberId || !Array.isArray(messages) || messages.length === 0) {
    return [];
  }

  return messages
    .map((m) => {
      const providerMessageId: string | undefined = m?.id;
      if (!providerMessageId) return null;

      return {
        phoneNumberId,
        providerMessageId,
        fromWaId: m?.from,
        messageType: m?.type,
        textBody: m?.text?.body,
        providerTimestamp: m?.timestamp,
        raw: m,
      } satisfies NormalizedInboundMessage;
    })
    .filter(Boolean) as NormalizedInboundMessage[];
}


