// Server-only MCP endpoint logic. Token in URL path, service-role scoped writes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256Hex } from "@/lib/connectors-shared";
import { workTypeForFile } from "@/lib/work-types";

const PROTOCOL_VERSION = "2025-06-18";
const ACCEPTED_PROTOCOLS = new Set([PROTOCOL_VERSION, "2025-03-26", "2024-11-05"]);
const MAX_TURNS = 500;
const MAX_THREAD_BYTES = 2 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-protocol-version, mcp-session-id",
  "Access-Control-Max-Age": "86400",
};

type Obj = Record<string, unknown>;

function rpcResult(id: unknown, result: Obj): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

function textResult(id: unknown, text: string): Response {
  return rpcResult(id, { content: [{ type: "text", text }] });
}

type Owner = { tokenId: string; profileId: string; orgId: string; userId: string | null };

async function resolveOwner(token: string): Promise<Owner | null> {
  if (!token) return null;
  const hash = await sha256Hex(token);
  const { data } = await supabaseAdmin
    .from("mcp_tokens")
    .select("id, profile_id, revoked_at, profiles!inner(id, org_id, user_id)")
    .eq("token_hash", hash)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  const profile = data.profiles as unknown as { org_id: string; user_id: string | null };
  await supabaseAdmin
    .from("mcp_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return {
    tokenId: data.id,
    profileId: data.profile_id,
    orgId: profile.org_id,
    userId: profile.user_id,
  };
}

async function logPush(owner: Owner, dims: Record<string, string>): Promise<void> {
  await recordEvent(supabaseAdmin, {
    eventType: "mcp.push",
    orgId: owner.orgId,
    userId: owner.userId,
    dims,
  });
  if (dims["tool"] === "push_thread" || dims["tool"] === "push_document") {
    await recordEvent(supabaseAdmin, {
      eventType: "workitem.captured",
      orgId: owner.orgId,
      userId: owner.userId,
      dims: { channel: "mcp", source: dims["source_ai"] ?? "mcp" },
    });
  }
}

const TOOLS = [
  {
    name: "push_thread",
    description:
      "Save an AI conversation to the user's Lasso workspace. It lands private and unmapped; the user organizes it later. Pass the conversation turns VERBATIM — do not summarize, do not omit turns.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for the conversation." },
        source_ai: { type: "string", enum: ["claude", "chatgpt", "gemini", "other"] },
        turns: {
          type: "array",
          maxItems: MAX_TURNS,
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant"] },
              content: { type: "string" },
              ts: { type: "string", description: "ISO 8601 timestamp, if known." },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["source_ai", "turns"],
    },
  },
  {
    name: "push_document",
    description:
      "Save a document or artifact produced in this session to the user's Lasso workspace (private, unmapped). Pass full exact content.",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string" },
        content: { type: "string" },
        mime_type: { type: "string" },
        engagement_hint: { type: "string" },
      },
      required: ["filename", "content"],
    },
  },
  {
    name: "list_engagements",
    description:
      "List the user's engagements and tasks so a pushed item can mention where it might belong. Read-only.",
    inputSchema: { type: "object", properties: {} },
  },
];

export async function handleMcpRequest(request: Request, token: string): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const owner = await resolveOwner(token);
  if (!owner) return json({ error: "Unauthorized" }, 401);

  let body: Obj;
  try {
    body = (await request.json()) as Obj;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  const id = body["id"];
  const method = String(body["method"] ?? "");
  const params = (body["params"] ?? {}) as Obj;

  if (method === "initialize") {
    const asked = String((params["protocolVersion"] as string) ?? PROTOCOL_VERSION);
    return rpcResult(id, {
      protocolVersion: ACCEPTED_PROTOCOLS.has(asked) ? asked : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: "lasso", version: "1.0.0" },
    });
  }

  if (method === "notifications/initialized" || method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: CORS_HEADERS });
  }

  if (method === "ping") return rpcResult(id, {});

  if (method === "tools/list") return rpcResult(id, { tools: TOOLS });

  if (method === "tools/call") {
    const name = String(params["name"] ?? "");
    const args = (params["arguments"] ?? {}) as Obj;
    try {
      if (name === "push_thread") return await pushThread(owner, args, id);
      if (name === "push_document") return await pushDocument(owner, args, id);
      if (name === "list_engagements") return await listEngagements(owner, id);
      return rpcError(id, -32602, `Unknown tool: ${name}`);
    } catch (e) {
      return rpcError(id, -32603, (e as Error).message);
    }
  }

  return rpcError(id, -32601, `Method not found: ${method}`);
}

type IncomingTurn = { role: string; content: string; ts?: string };

async function pushThread(owner: Owner, args: Obj, id: unknown): Promise<Response> {
  const raw = args["turns"];
  if (!Array.isArray(raw) || raw.length === 0) {
    return rpcError(id, -32602, "turns must be a non-empty array");
  }
  if (raw.length > MAX_TURNS) {
    return rpcError(id, -32602, `Too many turns (${raw.length}). Maximum is ${MAX_TURNS}.`);
  }
  const turns: IncomingTurn[] = [];
  for (const t of raw as IncomingTurn[]) {
    const role = t?.role === "assistant" ? "assistant" : t?.role === "user" ? "user" : null;
    if (!role || typeof t.content !== "string") {
      return rpcError(id, -32602, "Each turn needs role ('user'|'assistant') and string content");
    }
    turns.push({ role, content: t.content, ...(typeof t.ts === "string" ? { ts: t.ts } : {}) });
  }

  const serialized = JSON.stringify(turns.map((t) => ({ role: t.role, content: t.content })));
  const bytes = new TextEncoder().encode(serialized).byteLength;
  if (bytes > MAX_THREAD_BYTES) {
    return rpcError(id, -32602, "Conversation is larger than the 2MB limit. Push it in parts.");
  }

  const sourceAi = ["claude", "chatgpt", "gemini", "other"].includes(String(args["source_ai"]))
    ? String(args["source_ai"])
    : "other";
  const firstUser = turns.find((t) => t.role === "user")?.content ?? turns[0]?.content ?? "";
  const title =
    (typeof args["title"] === "string" && args["title"].trim()) ||
    firstUser.trim().slice(0, 60) ||
    "Untitled conversation";

  const { data: item, error } = await supabaseAdmin
    .from("work_items")
    .insert({
      owner_id: owner.profileId,
      org_id: owner.orgId,
      type: "ai_thread",
      source: `mcp:${sourceAi}`,
      title,
      visibility: "unmapped",
      content_fidelity: "transcribed",
      ts_precision: "capture",
      content_hash: await sha256Hex(serialized),
      meta: { assistant_transcribed: true },
    })
    .select("id")
    .single();
  if (error || !item) return rpcError(id, -32603, error?.message ?? "Could not save the conversation");

  const rows = await Promise.all(
    turns.map(async (t, i) => ({
      work_item_id: item.id,
      turn_no: i + 1,
      role: t.role as "user" | "assistant",
      content: t.content,
      content_hash: await sha256Hex(t.content),
      ts: null,
      ts_precision: "capture" as const,
      meta: t.ts ? { claimed_ts: t.ts } : {},
    })),
  );
  const { error: turnsError } = await supabaseAdmin.from("turns").insert(rows);
  if (turnsError) return rpcError(id, -32603, turnsError.message);

  await logPush(owner, { tool: "push_thread", source_ai: sourceAi });
  return textResult(
    id,
    `Saved to Lasso: '${title}' (${turns.length} turns). It is private until you map it.`,
  );
}

async function pushDocument(owner: Owner, args: Obj, id: unknown): Promise<Response> {
  const filename = typeof args["filename"] === "string" ? args["filename"] : "";
  const content = typeof args["content"] === "string" ? args["content"] : "";
  if (!filename || !content) return rpcError(id, -32602, "filename and content are required");

  const encoded = new TextEncoder().encode(content);
  if (encoded.byteLength > MAX_DOC_BYTES) {
    return rpcError(id, -32602, "Document is larger than the 5MB limit.");
  }
  if (!owner.userId) return rpcError(id, -32603, "This workspace account cannot store files yet.");

  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "document.txt";
  const path = `${owner.userId}/mcp-${crypto.randomUUID()}-${safe}`;
  const mime = typeof args["mime_type"] === "string" ? args["mime_type"] : "text/plain";

  const { error: uploadError } = await supabaseAdmin.storage
    .from("work-files")
    .upload(path, encoded, { contentType: mime, upsert: false });
  if (uploadError) return rpcError(id, -32603, uploadError.message);

  const hint = typeof args["engagement_hint"] === "string" ? args["engagement_hint"] : null;
  const { error } = await supabaseAdmin.from("work_items").insert({
    owner_id: owner.profileId,
    org_id: owner.orgId,
    type: workTypeForFile(safe),
    source: "mcp:push",
    title: filename,
    visibility: "unmapped",
    content_ref: path,
    content_fidelity: "verbatim",
    ts_precision: "capture",
    content_hash: await sha256Hex(content),
    meta: hint ? { assistant_transcribed: true, engagement_hint: hint } : { assistant_transcribed: true },
  });
  if (error) return rpcError(id, -32603, error.message);

  await logPush(owner, { tool: "push_document" });
  return textResult(id, `Saved '${filename}' to Lasso (private, unmapped).`);
}

async function listEngagements(owner: Owner, id: unknown): Promise<Response> {
  const { data: memberships } = await supabaseAdmin
    .from("engagement_members")
    .select("engagement_id")
    .eq("profile_id", owner.profileId);
  const ids = (memberships ?? []).map((m) => m.engagement_id);
  if (ids.length === 0) return textResult(id, "No engagements yet.");

  const { data: engagements } = await supabaseAdmin
    .from("engagements")
    .select("id, code, title")
    .in("id", ids);
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("engagement_id, name")
    .in("engagement_id", ids);

  const lines = (engagements ?? []).map((e) => {
    const names = (tasks ?? []).filter((t) => t.engagement_id === e.id).map((t) => `  - ${t.name}`);
    return [`${e.code} — ${e.title}`, ...(names.length ? names : ["  (no tasks yet)"])].join("\n");
  });
  await logPush(owner, { tool: "list_engagements" });
  return textResult(id, lines.join("\n\n"));
}