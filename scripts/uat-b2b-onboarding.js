/**
 * UAT B2B (onboarding) sem curl.
 *
 * Requer:
 * - BASE_URL (default: http://localhost:3000)
 * - MCP_B2B_TOKEN
 * - MEI_WA_ID
 *
 * Opcional:
 * - BUSINESS_NAME, MEI_DISPLAY_NAME
 * - UAT_SEND_REPLY=1 (habilita envio real via b2b.reply_to_mei)
 * - UAT_PHONE_NUMBER_ID (se não conseguir resolver via conversationId/AVENCE_PHONE_NUMBER_ID)
 */

function mustGetEnv(name) {
  const v = process.env[name];
  if (!v) {
    throw new Error(
      `Missing env ${name}. Dica (zsh): use "export ${name}=..." ou prefixe na mesma linha: ${name}=... npm run uat:b2b`,
    );
  }
  return v;
}

async function postJson(baseUrl, path, token, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-mcp-token": token,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} for ${path}`);
    err.details = { status: res.status, body: json ?? text };
    throw err;
  }

  return json;
}

async function main() {
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const token = mustGetEnv("MCP_B2B_TOKEN");
  const meiWaId = mustGetEnv("MEI_WA_ID");
  const businessName = process.env.BUSINESS_NAME || "Meu Negócio";
  const meiDisplayName = process.env.MEI_DISPLAY_NAME || "MEI Teste";
  const sendReply = process.env.UAT_SEND_REPLY === "1";
  const uatPhoneNumberId = process.env.UAT_PHONE_NUMBER_ID || undefined;

  console.log("==> UAT B2B onboarding");
  console.log(`BASE_URL=${baseUrl}`);
  console.log(`MEI_WA_ID=${meiWaId}`);

  console.log("\n1) create-business");
  const created = await postJson(baseUrl, "/api/mcp/b2b/create-business", token, {
    meiWaId,
    businessName,
    meiDisplayName,
  });
  const businessId = created?.data?.businessId;
  if (!businessId) throw new Error("create-business did not return data.businessId");
  console.log({ businessId });

  console.log("\n2) upsert-services");
  const servicesRes = await postJson(baseUrl, "/api/mcp/b2b/upsert-services", token, {
    businessId,
    services: [
      { name: "Corte", priceCents: 5000, durationMin: 45 },
      { name: "Barba", priceCents: 3500, durationMin: 30 },
    ],
  });
  console.log(servicesRes);

  console.log("\n3) upsert-availability");
  const availabilityRes = await postJson(
    baseUrl,
    "/api/mcp/b2b/upsert-availability",
    token,
    {
      businessId,
      rules: [
        { weekday: 1, startMin: 540, endMin: 1080 }, // seg 09:00-18:00
        { weekday: 2, startMin: 540, endMin: 1080 }, // ter 09:00-18:00
      ],
    },
  );
  console.log(availabilityRes);

  console.log("\n4) reply-to-mei");
  if (!sendReply) {
    console.log(
      "SKIP (default). Para enviar de verdade via WhatsApp Cloud API: UAT_SEND_REPLY=1 (e configurar WHATSAPP_ACCESS_TOKEN no backend).",
    );
  } else {
    const replyRes = await postJson(baseUrl, "/api/mcp/b2b/reply-to-mei", token, {
      businessId,
      meiWaId,
      text: "Onboarding concluído ✅",
      phoneNumberId: uatPhoneNumberId,
    });
    console.log(replyRes);
  }

  console.log("\nOK");
  console.log(`businessId=${businessId}`);
  console.log("Dica: valide no /api/admin/inspect?limit=50 (x-admin-seed-token).");
}

main().catch((err) => {
  console.error("UAT failed:", err.message);
  if (err.details) console.error(err.details);
  process.exit(1);
});


