import { prisma } from "@/server/infra/db/prisma";
import crypto from "crypto";
import { sendWhatsAppTextMessage } from "@/server/infra/whatsapp/send-text";
import { sendWhatsAppFlowMessage } from "@/server/infra/whatsapp/send-flow";

function stageToStateB2B(stage: string) {
  switch (stage) {
    case "HANDOFF_HUMAN":
      return "SUPPORT" as const;
    default:
      return "ONBOARDING" as const;
  }
}

export async function b2bGetMeiStatus(params: {
  meiWaId: string;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const { meiWaId, conversationId, phoneNumberId } = params;

  const contact = await prisma.meiContact.findUnique({
    where: { waId: meiWaId },
    select: { businessId: true, waId: true, displayName: true },
  });

  const business = contact?.businessId
    ? await prisma.business.findUnique({
        where: { id: contact.businessId },
        select: { id: true, name: true, plan: true },
      })
    : null;

  const conv = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          stageB2B: true,
          stateB2B: true,
          phoneNumberId: true,
          businessId: true,
        },
      })
    : await prisma.conversation.findFirst({
        where: { domain: "B2B", fromWaId: meiWaId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          stageB2B: true,
          stateB2B: true,
          phoneNumberId: true,
          businessId: true,
        },
      });

  const resolvedPhoneNumberId = phoneNumberId ?? conv?.phoneNumberId ?? undefined;
  const activeStage = conv?.stageB2B ?? "SALES_RECEPTION";

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_GET_MEI_STATUS",
      domain: "B2B",
      businessId: business?.id ?? contact?.businessId ?? conv?.businessId ?? undefined,
      phoneNumberId: resolvedPhoneNumberId,
      conversationId,
      payload: {
        meiWaId,
        isCustomer: Boolean(contact?.businessId),
        activeStage,
        plan: business?.plan ?? null,
      },
    },
  });

  return {
    meiWaId,
    isCustomer: Boolean(contact?.businessId),
    activeStage,
    business: business
      ? { id: business.id, name: business.name ?? null, plan: business.plan }
      : null,
    contact: contact
      ? { waId: contact.waId, displayName: contact.displayName ?? null }
      : null,
    conversation: conv
      ? {
          id: conv.id,
          stageB2B: conv.stageB2B,
          stateB2B: conv.stateB2B ?? null,
          phoneNumberId: conv.phoneNumberId ?? null,
          businessId: conv.businessId ?? null,
        }
      : null,
  };
}

export async function b2bCreateBusiness(params: {
  meiWaId: string;
  businessName?: string;
  meiDisplayName?: string;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const { meiWaId, businessName, meiDisplayName, conversationId, phoneNumberId } =
    params;

  // Creating a business is the "start onboarding" action. Per system-prompt, this implies
  // advancing the conversation stage to ONBOARDING_ASSISTED.
  const stageAfter = "ONBOARDING_ASSISTED" as const;

  const business = await prisma.business.create({
    data: { name: businessName },
  });

  await prisma.meiContact.upsert({
    where: { waId: meiWaId },
    create: { waId: meiWaId, displayName: meiDisplayName, businessId: business.id },
    update: { displayName: meiDisplayName, businessId: business.id },
  });

  const priorConversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { stageB2B: true },
      })
    : null;

  // Guardrail: per system-prompt, do not allow creating a business in SALES_RECEPTION.
  // Only valid after the agent advanced to SALES_DIAGNOSIS.
  if (priorConversation && priorConversation.stageB2B !== "SALES_DIAGNOSIS") {
    throw new Error(
      `b2b.create_business not allowed when stageB2B=${priorConversation.stageB2B}. Expected SALES_DIAGNOSIS.`,
    );
  }

  const conversation = conversationId
    ? await prisma.conversation.upsert({
        where: { id: conversationId },
        create: {
          id: conversationId,
          domain: "B2B",
          stateB2B: "ONBOARDING",
          stageB2B: stageAfter,
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
        update: {
          domain: "B2B",
          stateB2B: "ONBOARDING",
          stageB2B: stageAfter,
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
      })
    : await prisma.conversation.create({
        data: {
          domain: "B2B",
          stateB2B: "ONBOARDING",
          stageB2B: stageAfter,
          businessId: business.id,
          phoneNumberId,
          fromWaId: meiWaId,
        },
      });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_CREATE_BUSINESS",
      domain: "B2B",
      businessId: business.id,
      phoneNumberId: conversation.phoneNumberId ?? undefined,
      conversationId: conversation.id,
      payload: {
        meiWaId,
        stageBefore: priorConversation?.stageB2B ?? null,
        stageAfter,
      },
    },
  });

  return { businessId: business.id, conversationId: conversation.id };
}

export async function b2bSetStage(params: {
  stage:
    | "SALES_RECEPTION"
    | "SALES_DIAGNOSIS"
    | "ONBOARDING_ASSISTED"
    | "ONBOARDING_COMPLETED"
    | "PLAN_SELECTION"
    | "WAITING"
    | "HANDOFF_HUMAN";
  reason?: string;
  conversationId?: string;
  meiWaId?: string;
  phoneNumberId?: string;
}) {
  const { stage, reason, conversationId, meiWaId, phoneNumberId } = params;

  const targetId = conversationId || undefined;
  const desiredStateB2B = stageToStateB2B(stage);

  let conversation =
    targetId
      ? await prisma.conversation.findUnique({
          where: { id: targetId },
          select: { id: true, businessId: true, phoneNumberId: true, fromWaId: true },
        })
      : null;

  if (!conversation) {
    if (!meiWaId || !phoneNumberId) {
      throw new Error(
        "Conversation not found. Provide an existing conversationId or provide meiWaId + phoneNumberId to create one.",
      );
    }
    conversation = targetId
      ? await prisma.conversation.upsert({
          where: { id: targetId },
          create: {
            id: targetId,
            domain: "B2B",
            stateB2B: desiredStateB2B,
            stageB2B: stage,
            fromWaId: meiWaId,
            phoneNumberId,
          },
          update: {},
          select: { id: true, businessId: true, phoneNumberId: true, fromWaId: true },
        })
      : await prisma.conversation.create({
          data: {
            domain: "B2B",
            stateB2B: desiredStateB2B,
            stageB2B: stage,
            fromWaId: meiWaId,
            phoneNumberId,
          },
          select: { id: true, businessId: true, phoneNumberId: true, fromWaId: true },
        });
  }

  const updated = await prisma.conversation.update({
    where: { id: conversation.id },
    data: { stageB2B: stage, stateB2B: desiredStateB2B },
    select: { id: true, stageB2B: true, stateB2B: true, businessId: true, phoneNumberId: true },
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_STAGE_SET",
      domain: "B2B",
      businessId: updated.businessId ?? undefined,
      phoneNumberId: updated.phoneNumberId ?? undefined,
      conversationId: updated.id,
      payload: { stage, stateB2B: updated.stateB2B, reason: reason ?? null },
    },
  });

  return { conversationId: updated.id, stage: updated.stageB2B, stateB2B: updated.stateB2B };
}

export async function b2bGetContext(params: {
  conversationId?: string;
  meiWaId?: string;
}) {
  const { conversationId, meiWaId } = params;
  if (!conversationId && !meiWaId) {
    throw new Error("Provide conversationId or meiWaId.");
  }

  const conversation = conversationId
    ? await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: {
          id: true,
          domain: true,
          stateB2B: true,
          stageB2B: true,
          businessId: true,
          phoneNumberId: true,
          fromWaId: true,
          updatedAt: true,
        },
      })
    : await prisma.conversation.findFirst({
        where: { domain: "B2B", fromWaId: meiWaId ?? undefined },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          domain: true,
          stateB2B: true,
          stageB2B: true,
          businessId: true,
          phoneNumberId: true,
          fromWaId: true,
          updatedAt: true,
        },
      });

  const waId = meiWaId ?? conversation?.fromWaId ?? undefined;
  const contact = waId
    ? await prisma.meiContact.findUnique({
        where: { waId },
        select: { waId: true, displayName: true, businessId: true },
      })
    : null;

  const businessId = conversation?.businessId ?? contact?.businessId ?? undefined;
  const business = businessId
    ? await prisma.business.findUnique({
        where: { id: businessId },
        select: { id: true, name: true, plan: true },
      })
    : null;

  const services = businessId
    ? await prisma.service.findMany({
        where: { businessId, active: true },
        select: { name: true, priceCents: true, durationMin: true },
        orderBy: { name: "asc" },
      })
    : [];

  const availability = businessId
    ? await prisma.availabilityRule.findMany({
        where: { businessId },
        select: { weekday: true, startMin: true, endMin: true },
        orderBy: [{ weekday: "asc" }, { startMin: "asc" }],
      })
    : [];

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_GET_CONTEXT",
      domain: "B2B",
      businessId: business?.id ?? businessId ?? undefined,
      phoneNumberId: conversation?.phoneNumberId ?? undefined,
      conversationId: conversation?.id ?? conversationId ?? undefined,
      payload: {
        meiWaId: waId ?? null,
        hasConversation: Boolean(conversation),
        isCustomer: Boolean(contact?.businessId),
      },
    },
  });

  return {
    meiWaId: waId ?? null,
    isCustomer: Boolean(contact?.businessId),
    conversation: conversation
      ? {
          id: conversation.id,
          stageB2B: conversation.stageB2B,
          stateB2B: conversation.stateB2B ?? null,
          phoneNumberId: conversation.phoneNumberId ?? null,
          fromWaId: conversation.fromWaId ?? null,
          businessId: conversation.businessId ?? null,
          updatedAt: conversation.updatedAt.toISOString(),
        }
      : null,
    business: business ? { id: business.id, name: business.name ?? null, plan: business.plan } : null,
    services,
    availability,
  };
}

export async function b2bReplyToMeiRequested(params: {
  businessId?: string;
  meiWaId: string;
  text: string;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const { businessId, meiWaId, text, conversationId, phoneNumberId } = params;

  const derivedPhoneNumberId =
    phoneNumberId ??
    (conversationId
      ? (
          await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { phoneNumberId: true },
          })
        )?.phoneNumberId ?? undefined
      : undefined);

  const resolvedPhoneNumberId =
    derivedPhoneNumberId ?? (process.env.AVENCE_PHONE_NUMBER_ID || undefined);

  const idempotencyKey = [
    "b2b_reply_to_mei",
    conversationId ?? businessId ?? "no_business",
    meiWaId,
    crypto.createHash("sha256").update(text).digest("hex").slice(0, 24),
  ].join(":");

  // Record intent first (auditability).
  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_REPLY_TO_MEI_REQUESTED",
      domain: "B2B",
      businessId: businessId ?? undefined,
      phoneNumberId: resolvedPhoneNumberId,
      conversationId,
      payload: { meiWaId, text, idempotencyKey },
    },
  });

  if (!resolvedPhoneNumberId) {
    throw new Error(
      "Missing phoneNumberId to send WhatsApp message. Provide conversationId/phoneNumberId or set AVENCE_PHONE_NUMBER_ID.",
    );
  }

  // Idempotency: create a PENDING outbound record first; if it already exists, don't resend.
  try {
    await prisma.outboundMessage.create({
      data: {
        domain: "B2B",
        status: "PENDING",
        idempotencyKey,
        businessId: businessId ?? undefined,
        phoneNumberId: resolvedPhoneNumberId,
        conversationId,
        toWaId: meiWaId,
        text,
      },
    });
  } catch (e: any) {
    // Prisma unique violation
    if (e?.code === "P2002") {
      const existing = await prisma.outboundMessage.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.status === "SENT" && existing.providerMessageId) {
        return {
          sent: true as const,
          providerMessageId: existing.providerMessageId,
          deduped: true as const,
        };
      }
      return { sent: false as const, deduped: true as const };
    }
    throw e;
  }

  try {
    const { providerMessageId } = await sendWhatsAppTextMessage({
      phoneNumberId: resolvedPhoneNumberId,
      toWaId: meiWaId,
      text,
    });

    await prisma.$transaction([
      prisma.outboundMessage.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId, error: null },
      }),
      prisma.auditEvent.create({
        data: {
          eventType: "B2B_REPLY_TO_MEI_SENT",
          domain: "B2B",
          businessId: businessId ?? undefined,
          phoneNumberId: resolvedPhoneNumberId,
          conversationId,
          payload: { meiWaId, text, providerMessageId, idempotencyKey },
        },
      }),
    ]);

    return { sent: true as const, providerMessageId };
  } catch (err: any) {
    const error = String(err?.message ?? err);
    await prisma.$transaction([
      prisma.outboundMessage.update({
        where: { idempotencyKey },
        data: { status: "FAILED", error },
      }),
      prisma.auditEvent.create({
        data: {
          eventType: "B2B_REPLY_TO_MEI_FAILED",
          domain: "B2B",
          businessId: businessId ?? undefined,
          phoneNumberId: resolvedPhoneNumberId,
          conversationId,
          payload: { meiWaId, text, error, idempotencyKey },
        },
      }),
    ]);
    throw err;
  }
}

export async function b2bSendFlow(params: {
  businessId: string;
  meiWaId: string;
  bodyText: string;
  flowId?: string;
  flowToken: string;
  flowCta: string;
  screen?: string;
  data?: Record<string, unknown>;
  conversationId?: string;
  phoneNumberId?: string;
}) {
  const {
    businessId,
    meiWaId,
    bodyText,
    flowId,
    flowToken,
    flowCta,
    screen,
    data,
    conversationId,
    phoneNumberId,
  } = params;

  const derivedPhoneNumberId =
    phoneNumberId ??
    (conversationId
      ? (
          await prisma.conversation.findUnique({
            where: { id: conversationId },
            select: { phoneNumberId: true },
          })
        )?.phoneNumberId ?? undefined
      : undefined);

  const resolvedPhoneNumberId =
    derivedPhoneNumberId ?? (process.env.AVENCE_PHONE_NUMBER_ID || undefined);

  const resolvedFlowId = flowId ?? process.env.WHATSAPP_DEFAULT_FLOW_ID ?? "";

  const idempotencyKey = [
    "b2b_send_flow",
    conversationId ?? businessId,
    meiWaId,
    resolvedFlowId || "no_flow",
    screen || "START",
  ].join(":");

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_SEND_FLOW_REQUESTED",
      domain: "B2B",
      businessId,
      phoneNumberId: resolvedPhoneNumberId,
      conversationId,
      payload: {
        meiWaId,
        flowId: resolvedFlowId || null,
        flowCta,
        screen: screen || "START",
        idempotencyKey,
      },
    },
  });

  if (!resolvedPhoneNumberId) {
    throw new Error(
      "Missing phoneNumberId to send WhatsApp flow. Provide conversationId/phoneNumberId or set AVENCE_PHONE_NUMBER_ID.",
    );
  }
  if (!resolvedFlowId) {
    throw new Error(
      "Missing flowId. Provide flowId in the tool call or set WHATSAPP_DEFAULT_FLOW_ID.",
    );
  }

  try {
    await prisma.outboundMessage.create({
      data: {
        domain: "B2B",
        status: "PENDING",
        idempotencyKey,
        businessId,
        phoneNumberId: resolvedPhoneNumberId,
        conversationId,
        toWaId: meiWaId,
        text: `FLOW:${resolvedFlowId}:${screen || "START"}:${flowCta}`,
      },
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      const existing = await prisma.outboundMessage.findUnique({
        where: { idempotencyKey },
      });
      if (existing?.status === "SENT" && existing.providerMessageId) {
        return {
          sent: true as const,
          providerMessageId: existing.providerMessageId,
          deduped: true as const,
        };
      }
      return { sent: false as const, deduped: true as const };
    }
    throw e;
  }

  try {
    const { providerMessageId } = await sendWhatsAppFlowMessage({
      phoneNumberId: resolvedPhoneNumberId,
      toWaId: meiWaId,
      bodyText,
      flowId: resolvedFlowId,
      flowToken,
      flowCta,
      screen,
      data,
    });

    await prisma.$transaction([
      prisma.outboundMessage.update({
        where: { idempotencyKey },
        data: { status: "SENT", providerMessageId, error: null },
      }),
      prisma.auditEvent.create({
        data: {
          eventType: "B2B_SEND_FLOW_SENT",
          domain: "B2B",
          businessId,
          phoneNumberId: resolvedPhoneNumberId,
          conversationId,
          payload: {
            meiWaId,
            flowId: resolvedFlowId,
            providerMessageId,
            idempotencyKey,
          },
        },
      }),
    ]);

    return { sent: true as const, providerMessageId };
  } catch (err: any) {
    const error = String(err?.message ?? err);
    await prisma.$transaction([
      prisma.outboundMessage.update({
        where: { idempotencyKey },
        data: { status: "FAILED", error },
      }),
      prisma.auditEvent.create({
        data: {
          eventType: "B2B_SEND_FLOW_FAILED",
          domain: "B2B",
          businessId,
          phoneNumberId: resolvedPhoneNumberId,
          conversationId,
          payload: { meiWaId, error, idempotencyKey },
        },
      }),
    ]);
    throw err;
  }
}

export async function b2bShowPlanSelection(params: {
  businessId: string;
  meiWaId: string;
  conversationId?: string;
  phoneNumberId?: string;
  flowToken: string;
  flowCta: string;
  // Optional overrides
  flowId?: string;
  screen?: string;
  data?: Record<string, unknown>;
}) {
  const { businessId, meiWaId, conversationId, phoneNumberId, flowToken, flowCta } =
    params;
  const flowId = params.flowId ?? process.env.WHATSAPP_PLAN_FLOW_ID ?? undefined;
  const screen = params.screen ?? "PLAN_SELECTION";
  const data = params.data ?? { businessId };

  if (!conversationId) {
    throw new Error("b2b.show_plan_selection requires conversationId (for guardrails).");
  }

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { stageB2B: true },
  });
  if (!conv) throw new Error("Conversation not found");
  if (conv.stageB2B !== "ONBOARDING_COMPLETED") {
    throw new Error(
      `Plan selection is only allowed after ONBOARDING_COMPLETED. Current stageB2B=${conv.stageB2B}`,
    );
  }

  await b2bSetStage({
    stage: "PLAN_SELECTION",
    conversationId,
    reason: "MEI requested plan selection / checkout",
  });

  return b2bSendFlow({
    businessId,
    meiWaId,
    bodyText: "Perfeito — vou te mostrar as opções de plano. É rapidinho.",
    flowId,
    flowToken,
    flowCta,
    screen,
    data,
    conversationId,
    phoneNumberId,
  });
}

export async function b2bOpenCheckoutComponent(params: {
  businessId: string;
  meiWaId: string;
  conversationId: string;
  phoneNumberId?: string;
  plan?: "START" | "PRO" | "PAY";
}) {
  const { businessId, meiWaId, conversationId, phoneNumberId, plan } = params;

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { stageB2B: true },
  });
  if (!conv) throw new Error("Conversation not found");
  if (conv.stageB2B !== "ONBOARDING_COMPLETED") {
    throw new Error(
      `Checkout is only allowed after ONBOARDING_COMPLETED. Current stageB2B=${conv.stageB2B}`,
    );
  }

  const baseUrl = process.env.AVENCE_CHECKOUT_URL_BASE;
  if (!baseUrl) {
    throw new Error("Missing env AVENCE_CHECKOUT_URL_BASE");
  }

  const url = new URL(baseUrl);
  url.searchParams.set("businessId", businessId);
  url.searchParams.set("conversationId", conversationId);
  if (plan) url.searchParams.set("plan", plan);

  await b2bSetStage({
    stage: "PLAN_SELECTION",
    conversationId,
    reason: "Checkout opened",
  });

  await prisma.auditEvent.create({
    data: {
      eventType: "B2B_OPEN_CHECKOUT_REQUESTED",
      domain: "B2B",
      businessId,
      phoneNumberId: phoneNumberId ?? undefined,
      conversationId,
      payload: { meiWaId, url: url.toString(), plan: plan ?? null },
    },
  });

  return b2bReplyToMeiRequested({
    businessId,
    meiWaId,
    conversationId,
    phoneNumberId,
    text: `Aqui está o link para escolher/assinar o plano com segurança:\n${url.toString()}`,
  });
}


