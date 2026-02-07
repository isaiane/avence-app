import fs from "fs";
import path from "path";
import express from "express";
import crypto from "crypto";

// Minimal .env loader (so you don't need to export vars manually when running this adapter).
// Next.js loads .env automatically, but this standalone Node process does not.
function loadDotEnvIfPresent() {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const withoutExport = trimmed.startsWith("export ")
        ? trimmed.slice("export ".length).trim()
        : trimmed;
      const eq = withoutExport.indexOf("=");
      if (eq <= 0) continue;
      const key = withoutExport.slice(0, eq).trim();
      let value = withoutExport.slice(eq + 1).trim();
      // Strip surrounding quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // ignore missing/invalid .env
  }
}

loadDotEnvIfPresent();

// MCP SDK (ESM). Version pinned in package.json.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  InitializeRequestSchema,
  InitializedNotificationSchema,
} from "@modelcontextprotocol/sdk/types.js";

// This MCP adapter is a *separate* server meant to be consumed by ChatKit UI.
// It stays agnostic by calling the Next.js backend via HTTP (Agent Jobs + MCP tool-like endpoints).

const PORT = Number(process.env.MCP_SERVER_PORT || 3333);
const MCP_TOKEN = process.env.MCP_SERVER_TOKEN;
const BACKEND_BASE_URL = process.env.MCP_ADAPTER_BACKEND_URL || "http://localhost:3000";
const AGENT_JOBS_TOKEN = process.env.AGENT_JOBS_TOKEN || "";
const MCP_B2B_TOKEN = process.env.MCP_B2B_TOKEN || "";

function safeEqual(a, b) {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function requireToken(req, res) {
  if (!MCP_TOKEN) return true; // allow no-auth in dev if not configured

  const auth = req.header("authorization");
  const apiKey = req.header("x-api-key");
  const queryToken =
    req.query?.token ||
    req.query?.access_token ||
    req.query?.api_key ||
    null;
  const provided =
    (auth && auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null) ||
    apiKey ||
    queryToken ||
    null;

  if (!provided) {
    // eslint-disable-next-line no-console
    console.log(`[MCP] 401 missing token on ${req.method} ${req.path}`);
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  const ok = safeEqual(provided, MCP_TOKEN);
  if (!ok) {
    // eslint-disable-next-line no-console
    console.log(`[MCP] 401 invalid token on ${req.method} ${req.path}`);
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }

  return true;
}

async function backendJson(path, opts) {
  const res = await fetch(`${BACKEND_BASE_URL}${path}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    throw new Error(`Backend HTTP ${res.status} ${path}: ${text.slice(0, 500)}`);
  }
  return json;
}

const mcpServer = new Server(
  { name: "avence-mcp-adapter", version: "0.7.0" },
  { capabilities: { tools: { listChanged: false } } },
);

// Some clients (including ChatKit/Agent Builder) will retry initialize if they don't like
// the response or can't read it. We implement explicit handlers to be extra compatible
// with protocolVersion 2025-11-25.
mcpServer.setRequestHandler(InitializeRequestSchema, async (req) => {
  // eslint-disable-next-line no-console
  console.log(`[MCP] initialize protocolVersion=${req.params.protocolVersion}`);
  return {
    protocolVersion: req.params.protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: "avence-mcp-adapter", version: "0.7.0" },
  };
});

mcpServer.setNotificationHandler(InitializedNotificationSchema, async () => {
  // eslint-disable-next-line no-console
  console.log("[MCP] initialized notification");
});

// Tools exposed to ChatKit/Agent Kit
const tools = [
  {
    name: "ping",
    description: "Health check tool. Always returns pong.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "jobs.b2b_next",
    description: "Claim next pending B2B AgentJob (outbox).",
    inputSchema: {
      type: "object",
      properties: {
        lockedBy: { type: "string", description: "Worker identifier" },
      },
      required: ["lockedBy"],
      additionalProperties: false,
    },
  },
  {
    name: "jobs.b2b_complete",
    description: "Mark B2B AgentJob as DONE.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        lockedBy: { type: "string" },
      },
      required: ["id", "lockedBy"],
      additionalProperties: false,
    },
  },
  {
    name: "jobs.b2b_fail",
    description: "Mark B2B AgentJob as FAILED with error.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string" },
        lockedBy: { type: "string" },
        error: { type: "string" },
      },
      required: ["id", "lockedBy", "error"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.create_business",
    description: "Create a new business and link MEI contact (B2B).",
    inputSchema: {
      type: "object",
      properties: {
        meiWaId: { type: "string" },
        businessName: { type: "string" },
        meiDisplayName: { type: "string" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
      },
      required: ["meiWaId"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.set_stage",
    description:
      "Persist B2B onboarding stage (stateless checkpoint). Also emits audit event.",
    inputSchema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          enum: [
            "SALES_RECEPTION",
            "SALES_DIAGNOSIS",
            "ONBOARDING_ASSISTED",
            "ONBOARDING_COMPLETED",
            "PLAN_SELECTION",
            "WAITING",
            "HANDOFF_HUMAN",
          ],
        },
        reason: { type: "string" },
        conversationId: { type: "string" },
        meiWaId: { type: "string" },
        phoneNumberId: { type: "string" },
      },
      required: ["stage"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.get_context",
    description:
      "Read-only. Get current conversation stage + business/services/availability context for resuming a B2B chat.",
    inputSchema: {
      type: "object",
      properties: {
        conversationId: { type: "string" },
        meiWaId: { type: "string" },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.get_mei_status",
    description:
      "Read-only. Check whether a MEI waId is already a customer and return business/plan context (B2B).",
    inputSchema: {
      type: "object",
      properties: {
        meiWaId: { type: "string" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
      },
      required: ["meiWaId"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.reply_to_mei",
    description: "Send a WhatsApp text reply to MEI (B2B) via backend.",
    inputSchema: {
      type: "object",
      properties: {
        businessId: { type: "string", description: "Optional. If omitted, backend will audit without businessId." },
        meiWaId: { type: "string" },
        text: { type: "string" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
      },
      required: ["meiWaId", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.show_plan_selection",
    description:
      "Moment 4. Show plan selection to the MEI. Implemented via WhatsApp Flow (screen=PLAN_SELECTION).",
    inputSchema: {
      type: "object",
      properties: {
        businessId: { type: "string" },
        meiWaId: { type: "string" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
        flowToken: { type: "string" },
        flowCta: { type: "string" },
        flowId: { type: "string" },
        screen: { type: "string" },
        data: { type: "object" },
      },
      required: ["businessId", "meiWaId", "conversationId", "flowToken", "flowCta"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.open_checkout_component",
    description:
      "Moment 4. Send a checkout link to the MEI. Requires AVENCE_CHECKOUT_URL_BASE on backend.",
    inputSchema: {
      type: "object",
      properties: {
        businessId: { type: "string" },
        meiWaId: { type: "string" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
        plan: { type: "string", enum: ["START", "PRO", "PAY"] },
      },
      required: ["businessId", "meiWaId", "conversationId"],
      additionalProperties: false,
    },
  },
  {
    name: "b2b.send_flow",
    description:
      "Send a WhatsApp Flow (interactive form) to the MEI (B2B). Requires flowToken + flowCta; flowId optional if WHATSAPP_DEFAULT_FLOW_ID is set.",
    inputSchema: {
      type: "object",
      properties: {
        businessId: { type: "string" },
        meiWaId: { type: "string" },
        bodyText: { type: "string" },
        flowId: { type: "string" },
        flowToken: { type: "string" },
        flowCta: { type: "string" },
        screen: { type: "string" },
        data: { type: "object" },
        conversationId: { type: "string" },
        phoneNumberId: { type: "string" },
      },
      required: ["businessId", "meiWaId", "bodyText", "flowToken", "flowCta"],
      additionalProperties: false,
    },
  },
];

mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  // eslint-disable-next-line no-console
  console.log(`[MCP] list_tools (count=${tools.length})`);
  return { tools };
});

mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  // eslint-disable-next-line no-console
  console.log(`[MCP] call_tool name=${name}`);
  try {
    switch (name) {
      case "ping": {
        const result = { content: [{ type: "text", text: "pong" }] };
        // eslint-disable-next-line no-console
        console.log(`[MCP] tool_result name=ping -> pong`);
        return result;
      }
      case "jobs.b2b_next": {
        if (!AGENT_JOBS_TOKEN) throw new Error("Missing env AGENT_JOBS_TOKEN for backend access.");
        const out = await backendJson(
          `/api/agent-jobs/b2b/next?lockedBy=${encodeURIComponent(args.lockedBy)}`,
          {
            method: "GET",
            headers: { "x-agent-jobs-token": AGENT_JOBS_TOKEN },
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data?.job ?? null) }] };
      }
      case "jobs.b2b_complete": {
        if (!AGENT_JOBS_TOKEN) throw new Error("Missing env AGENT_JOBS_TOKEN for backend access.");
        const out = await backendJson(
          `/api/agent-jobs/b2b/${encodeURIComponent(args.id)}/complete?lockedBy=${encodeURIComponent(
            args.lockedBy,
          )}`,
          {
            method: "POST",
            headers: { "x-agent-jobs-token": AGENT_JOBS_TOKEN },
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data?.job ?? null) }] };
      }
      case "jobs.b2b_fail": {
        if (!AGENT_JOBS_TOKEN) throw new Error("Missing env AGENT_JOBS_TOKEN for backend access.");
        const out = await backendJson(
          `/api/agent-jobs/b2b/${encodeURIComponent(args.id)}/fail?lockedBy=${encodeURIComponent(
            args.lockedBy,
          )}`,
          {
            method: "POST",
            headers: {
              "x-agent-jobs-token": AGENT_JOBS_TOKEN,
              "content-type": "application/json",
            },
            body: JSON.stringify({ error: args.error }),
          },
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data?.job ?? null) }] };
      }
      case "b2b.create_business": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/create-business`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            meiWaId: args.meiWaId,
            businessName: args.businessName,
            meiDisplayName: args.meiDisplayName,
            conversationId: args.conversationId,
            phoneNumberId: args.phoneNumberId,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.set_stage": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/set-stage`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            stage: args.stage,
            reason: args.reason,
            conversationId: args.conversationId,
            meiWaId: args.meiWaId,
            phoneNumberId: args.phoneNumberId,
          }),
        });
        // eslint-disable-next-line no-console
        console.log(
          `[MCP] tool_result name=b2b.set_stage stage=${out?.data?.stage ?? "null"} conversationId=${out?.data?.conversationId ?? "null"}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.show_plan_selection": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/show-plan-selection`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            businessId: args.businessId,
            meiWaId: args.meiWaId,
            conversationId: args.conversationId,
            phoneNumberId: args.phoneNumberId,
            flowToken: args.flowToken,
            flowCta: args.flowCta,
            flowId: args.flowId,
            screen: args.screen,
            data: args.data,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.open_checkout_component": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/open-checkout-component`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            businessId: args.businessId,
            meiWaId: args.meiWaId,
            conversationId: args.conversationId,
            phoneNumberId: args.phoneNumberId,
            plan: args.plan,
          }),
        });
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.get_context": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const body = {
          ...(args.conversationId ? { conversationId: args.conversationId } : {}),
          ...(args.meiWaId ? { meiWaId: args.meiWaId } : {}),
        };
        const out = await backendJson(`/api/mcp/b2b/get-context`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.get_mei_status": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const body = {
          meiWaId: args.meiWaId,
          ...(args.conversationId ? { conversationId: args.conversationId } : {}),
          ...(args.phoneNumberId ? { phoneNumberId: args.phoneNumberId } : {}),
        };
        const out = await backendJson(`/api/mcp/b2b/get-mei-status`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify(body),
        });
        const data = out?.data ?? null;
        const isCustomer = Boolean(data?.isCustomer);
        // eslint-disable-next-line no-console
        console.log(
          `[MCP] tool_result name=b2b.get_mei_status isCustomer=${isCustomer} activeStage=${data?.activeStage ?? "null"} businessId=${data?.business?.id ?? "null"} plan=${data?.business?.plan ?? "null"}`,
        );
        return {
          content: [
            {
              type: "text",
              text: `isCustomer=${isCustomer}\nactiveStage=${data?.activeStage ?? "SALES_RECEPTION"}\n${JSON.stringify(data)}`,
            },
          ],
        };
      }
      case "b2b.reply_to_mei": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/reply-to-mei`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            businessId: args.businessId,
            meiWaId: args.meiWaId,
            text: args.text,
            conversationId: args.conversationId,
            phoneNumberId: args.phoneNumberId,
          }),
        });
        // eslint-disable-next-line no-console
        console.log(
          `[MCP] tool_result name=b2b.reply_to_mei sent=${Boolean(out?.data?.sent)} providerMessageId=${out?.data?.providerMessageId ?? "null"} deduped=${Boolean(out?.data?.deduped)}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      case "b2b.send_flow": {
        if (!MCP_B2B_TOKEN) throw new Error("Missing env MCP_B2B_TOKEN for backend access.");
        const out = await backendJson(`/api/mcp/b2b/send-flow`, {
          method: "POST",
          headers: {
            "x-mcp-token": MCP_B2B_TOKEN,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            businessId: args.businessId,
            meiWaId: args.meiWaId,
            bodyText: args.bodyText,
            flowId: args.flowId,
            flowToken: args.flowToken,
            flowCta: args.flowCta,
            screen: args.screen,
            data: args.data,
            conversationId: args.conversationId,
            phoneNumberId: args.phoneNumberId,
          }),
        });
        // eslint-disable-next-line no-console
        console.log(
          `[MCP] tool_result name=b2b.send_flow sent=${Boolean(out?.data?.sent)} providerMessageId=${out?.data?.providerMessageId ?? "null"}`,
        );
        return { content: [{ type: "text", text: JSON.stringify(out?.data ?? null) }] };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[MCP] tool_error name=${name} error=${String(e)}`);
    return {
      content: [{ type: "text", text: JSON.stringify({ error: String(e) }) }],
      isError: true,
    };
  }
});

const app = express();

// CORS: ChatKit UI typically runs in a browser context.
// Allow cross-origin GET/POST/OPTIONS for SSE + message endpoints.
app.use((req, res, next) => {
  const origin = req.headers.origin || "*";
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader(
    "Access-Control-Allow-Headers",
    [
      "authorization",
      "content-type",
      "x-api-key",
      "x-agent-jobs-token",
      "x-mcp-token",
    ].join(", "),
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
});

// We keep transports per-session in-memory (dev). Good enough for ngrok/local.
const transports = new Map();

app.get("/mcp/sse", async (req, res) => {
  if (!requireToken(req, res)) return;
  // eslint-disable-next-line no-console
  console.log(`[MCP] /mcp/sse connect from ${req.ip}`);
  const transport = new SSEServerTransport("/mcp/message", res);
  transports.set(transport.sessionId, transport);
  res.on("close", () => transports.delete(transport.sessionId));
  await mcpServer.connect(transport);
});

app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports.get(sessionId);
  if (!transport) {
    // eslint-disable-next-line no-console
    console.log(`[MCP] /mcp/message unknown sessionId=${sessionId}`);
    res.status(400).json({ error: "Unknown sessionId" });
    return;
  }

  // eslint-disable-next-line no-console
  console.log(`[MCP] /mcp/message sessionId=${sessionId}`);
  // IMPORTANT:
  // Do NOT use express.json/body parsers here, because the MCP SSE transport expects
  // to read the raw request stream to parse JSON-RPC. If a body parser consumes it,
  // `handlePostMessage` will fail (commonly with 400).
  // We also do not require auth on /mcp/message once the sessionId exists, because
  // sessionId is unguessable and created via the authenticated SSE call.
  // eslint-disable-next-line no-console
  console.log(
    `[MCP] /mcp/message headers content-type=${req.header("content-type") ?? ""} content-length=${req.header("content-length") ?? ""}`,
  );

  try {
    res.on("finish", () => {
      // eslint-disable-next-line no-console
      console.log(`[MCP] /mcp/message responded status=${res.statusCode}`);
    });
    await transport.handlePostMessage(req, res);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.log(`[MCP] /mcp/message handlePostMessage error: ${String(e)}`);
    if (!res.headersSent) res.status(500).json({ error: "MCP message handling failed" });
  }
});

app.get("/", (_req, res) => {
  res.status(200).send("Avence MCP Adapter Server OK. Use /mcp/sse");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP adapter listening on http://localhost:${PORT}`);
  console.log(`SSE: http://localhost:${PORT}/mcp/sse`);
});


