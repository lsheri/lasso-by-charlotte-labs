// Server-only MCP endpoint logic. Token in URL path, service-role scoped writes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { sha256Hex } from "@/lib/connectors-shared";
import { workTypeForFile } from "@/lib/work-types";
import { recordEvent } from "@/lib/telemetry.server";
import {
  ATTACHMENT_KINDS,
  CONVERSATION_VENDORS,
  attachmentBucket,
  type SourceMeta,
} from "@/lib/conversation-shared";

const PROTOCOL_VERSION = "2025-06-18";
const ACCEPTED_PROTOCOLS = new Set([PROTOCOL_VERSION, "2025-03-26", "2024-11-05"]);
const MAX_TURNS = 500;
const MAX_THREAD_BYTES = 2 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 40;

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type, authorization, mcp-protocol-version, mcp-session-id",
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
    name: "push_conversation",
    description:
      "When the user says 'Push to Lasso', 'send to Lasso', or similar: call push_conversation EXACTLY ONCE with the ENTIRE conversation, every message, verbatim, unabridged, plus EVERY artifact, canvas, file, or report created during the conversation as attachments. Never summarize the transcript. Never split one conversation across multiple calls or use push_document for conversation artifacts.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "The conversation title EXACTLY as shown in the source app, verbatim. Never invent or rephrase.",
        },
        vendor: {
          type: "string",
          enum: [...CONVERSATION_VENDORS],
          description: "The app this conversation happened in.",
        },
        model: {
          type: "string",
          description:
            "The model used, as named in the source app (e.g. 'Claude Opus 4.5', 'GPT-5').",
        },
        orig_conversation_id: {
          type: "string",
          description:
            "Stable ID for the source thread; all pushes for the same conversation MUST reuse it.",
        },
        messages: {
          type: "array",
          maxItems: MAX_TURNS,
          description:
            "Every message in order, complete and verbatim. Include timestamps ONLY if actually known from the source; NEVER invent timestamps.",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant", "tool"] },
              content: { type: "string", description: "VERBATIM, unabridged message content." },
              timestamp: { type: "string", description: "ISO 8601, only if actually known." },
            },
            required: ["role", "content"],
          },
        },
        attachments: {
          type: "array",
          maxItems: MAX_ATTACHMENTS,
          description:
            "Every artifact, canvas, file, page, or report created during the conversation.",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: [...ATTACHMENT_KINDS] },
              title: { type: "string", description: "Title verbatim as shown in the source app." },
              content: { type: "string", description: "Verbatim source or text." },
              language: { type: "string" },
            },
            required: ["kind", "title", "content"],
          },
        },
        meta: {
          type: "object",
          properties: {
            skills_used: { type: "array", items: { type: "string" } },
            thinking_level: { type: "string", enum: ["none", "medium", "high", "extended"] },
            research_mode: { type: "string", enum: ["none", "web_search", "deep_research"] },
            notes: { type: "string" },
          },
        },
      },
      required: ["title", "vendor", "orig_conversation_id", "messages"],
    },
  },
  {
    name: "push_thread",
    description:
      "Prefer push_conversation for anything conversation-shaped; use this only for a standalone transcript with no artifacts and no source conversation to group it with.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "The conversation/document title EXACTLY as it appears in the source app, verbatim.",
        },
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
      required: ["title", "source_ai", "turns"],
    },
  },
  {
    name: "push_document",
    description:
      "Prefer push_conversation for anything conversation-shaped; use this only for a standalone document with no source conversation.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description:
            "The conversation/document title EXACTLY as it appears in the source app, verbatim.",
        },
        filename: { type: "string" },
        content: { type: "string" },
        mime_type: { type: "string" },
        engagement_hint: { type: "string" },
      },
      required: ["title", "filename", "content"],
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
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers: CORS_HEADERS });
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
      if (name === "push_conversation") return await pushConversation(owner, args, id);
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
  // Verbatim: a supplied title is stored exactly as given, never renamed or synthesized.
  const supplied = typeof args["title"] === "string" ? args["title"] : "";
  const title =
    supplied.length > 0 ? supplied : firstUser.trim().slice(0, 60) || "Untitled conversation";

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
  if (error || !item)
    return rpcError(id, -32603, error?.message ?? "Could not save the conversation");

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

  const { ensureExtracts } = await import("./extract.server");
  await ensureExtracts([item.id]);

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
  const suppliedTitle = typeof args["title"] === "string" ? args["title"] : "";
  const title = suppliedTitle.length > 0 ? suppliedTitle : filename;

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
  const { data: doc, error } = await supabaseAdmin.from("work_items").insert({
    owner_id: owner.profileId,
    org_id: owner.orgId,
    type: workTypeForFile(safe),
    source: "mcp:push",
    title,
    visibility: "unmapped",
    content_ref: path,
    source_meta: { filename, mime_type: mime },
    content_fidelity: "verbatim",
    ts_precision: "capture",
    content_hash: await sha256Hex(content),
    meta: hint
      ? { assistant_transcribed: true, engagement_hint: hint }
      : { assistant_transcribed: true },
  })
    .select("id")
    .maybeSingle();
  if (error) return rpcError(id, -32603, error.message);

  const { ensureExtracts } = await import("./extract.server");
  if (doc?.id) await ensureExtracts([doc.id]);

  await logPush(owner, { tool: "push_document" });
  return textResult(id, `Saved '${title}' to Lasso (private, unmapped).`);
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
    return [`${e.code}, ${e.title}`, ...(names.length ? names : ["  (no tasks yet)"])].join("\n");
  });
  await logPush(owner, { tool: "list_engagements" });
  return textResult(id, lines.join("\n\n"));
}

type IncomingMessage = { role: string; content: string; timestamp?: string };
type IncomingAttachment = { kind: string; title: string; content: string; language?: string };

const ATTACHMENT_TYPES: Record<string, "document" | "image" | "deck" | "sheet"> = {
  artifact_svg: "image",
  image_description: "image",
};

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "attachment"
  );
}

/**
 * The canonical push. One call = one conversation: a transcript work item plus
 * one work item per attachment, all sharing orig_conversation_id so the app can
 * render them as a single group. Re-pushing the same conversation updates in
 * place rather than duplicating.
 */
async function pushConversation(owner: Owner, args: Obj, id: unknown): Promise<Response> {
  const title = typeof args["title"] === "string" ? args["title"].trim() : "";
  if (!title) return rpcError(id, -32602, "title is required, verbatim from the source app");

  const vendor = CONVERSATION_VENDORS.includes(String(args["vendor"]) as never)
    ? String(args["vendor"])
    : "other";

  const origId =
    typeof args["orig_conversation_id"] === "string" ? args["orig_conversation_id"].trim() : "";
  if (!origId) return rpcError(id, -32602, "orig_conversation_id is required");

  const rawMessages = args["messages"];
  if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
    return rpcError(id, -32602, "messages must be a non-empty array");
  }
  if (rawMessages.length > MAX_TURNS) {
    return rpcError(id, -32602, `Too many messages (${rawMessages.length}). Max is ${MAX_TURNS}.`);
  }

  const messages: IncomingMessage[] = [];
  for (const m of rawMessages as IncomingMessage[]) {
    const role =
      m?.role === "assistant" || m?.role === "tool" || m?.role === "user" ? m.role : null;
    if (!role || typeof m.content !== "string") {
      return rpcError(id, -32602, "Each message needs role (user|assistant|tool) and content");
    }
    messages.push({
      role,
      content: m.content,
      ...(typeof m.timestamp === "string" && m.timestamp ? { timestamp: m.timestamp } : {}),
    });
  }

  const serialized = JSON.stringify(messages.map((m) => ({ role: m.role, content: m.content })));
  if (new TextEncoder().encode(serialized).byteLength > MAX_THREAD_BYTES) {
    return rpcError(id, -32602, "Conversation is larger than the 2MB limit. Push it in parts.");
  }

  const rawAttachments = Array.isArray(args["attachments"])
    ? (args["attachments"] as IncomingAttachment[])
    : [];
  if (rawAttachments.length > MAX_ATTACHMENTS) {
    return rpcError(id, -32602, `Too many attachments. Max is ${MAX_ATTACHMENTS}.`);
  }
  const attachments: IncomingAttachment[] = [];
  for (const a of rawAttachments) {
    if (!a || typeof a.title !== "string" || typeof a.content !== "string" || !a.title.trim()) {
      return rpcError(id, -32602, "Each attachment needs kind, verbatim title, and content");
    }
    attachments.push({
      kind: ATTACHMENT_KINDS.includes(String(a.kind) as never) ? String(a.kind) : "other",
      title: a.title.trim(),
      content: a.content,
      ...(typeof a.language === "string" ? { language: a.language } : {}),
    });
  }

  const model =
    typeof args["model"] === "string" && args["model"].trim() ? args["model"].trim() : null;
  const metaIn = (args["meta"] ?? {}) as {
    skills_used?: unknown;
    thinking_level?: unknown;
    research_mode?: unknown;
    notes?: unknown;
  };
  const sharedMeta: SourceMeta = {
    vendor,
    model,
    ...(Array.isArray(metaIn.skills_used)
      ? { skills_used: metaIn.skills_used.filter((s): s is string => typeof s === "string") }
      : {}),
    ...(typeof metaIn.thinking_level === "string" ? { thinking_level: metaIn.thinking_level } : {}),
    ...(typeof metaIn.research_mode === "string" ? { research_mode: metaIn.research_mode } : {}),
    ...(typeof metaIn.notes === "string" ? { notes: metaIn.notes } : {}),
  };

  // ---- transcript work item (insert or update in place) --------------------
  const { data: existingThread } = await supabaseAdmin
    .from("work_items")
    .select("id")
    .eq("owner_id", owner.profileId)
    .eq("orig_conversation_id", origId)
    .eq("type", "ai_thread")
    .maybeSingle();

  const threadFields = {
    owner_id: owner.profileId,
    org_id: owner.orgId,
    type: "ai_thread" as const,
    source: `mcp:${vendor}`,
    source_vendor: vendor,
    orig_conversation_id: origId,
    title,
    content_fidelity: "transcribed",
    ts_precision: "capture" as const,
    content_hash: await sha256Hex(serialized),
    source_meta: { ...sharedMeta, role: "transcript" } as unknown as Json,
    meta: { assistant_transcribed: true },
  };

  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
    const { error } = await supabaseAdmin
      .from("work_items")
      .update(threadFields)
      .eq("id", threadId);
    if (error) return rpcError(id, -32603, error.message);
    const del = await supabaseAdmin.from("turns").delete().eq("work_item_id", threadId);
    if (del.error) return rpcError(id, -32603, del.error.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("work_items")
      .insert({ ...threadFields, visibility: "unmapped" })
      .select("id")
      .single();
    if (error || !data) return rpcError(id, -32603, error?.message ?? "Could not save it");
    threadId = data.id;
  }

  const turnRows = await Promise.all(
    messages.map(async (m, i) => ({
      work_item_id: threadId,
      turn_no: i + 1,
      role: m.role as "user" | "assistant" | "tool",
      content: m.content,
      content_hash: await sha256Hex(m.content),
      ts: m.timestamp ?? null,
      ts_precision: (m.timestamp ? "source" : "capture") as "source" | "capture",
      ...(model ? { model } : {}),
      meta: {},
    })),
  );
  const { error: turnsError } = await supabaseAdmin.from("turns").insert(turnRows);
  if (turnsError) return rpcError(id, -32603, turnsError.message);

  // ---- attachments (upsert by orig_conversation_id + title) ----------------
  let saved = 0;
  const capturedIds: string[] = [threadId];
  const problems: string[] = [];
  if (attachments.length > 0 && !owner.userId) {
    problems.push("attachments need a signed-in workspace account");
  } else {
    const { data: existingAttachments } = await supabaseAdmin
      .from("work_items")
      .select("id, title")
      .eq("owner_id", owner.profileId)
      .eq("orig_conversation_id", origId)
      .neq("type", "ai_thread");

    for (const attachment of attachments) {
      const encoded = new TextEncoder().encode(attachment.content);
      if (encoded.byteLength > MAX_DOC_BYTES) {
        problems.push(`'${attachment.title}' is over the 5MB limit`);
        continue;
      }
      const path = `${owner.userId}/conv-${slugify(origId)}-${slugify(attachment.title)}`;
      const upload = await supabaseAdmin.storage
        .from("work-files")
        .upload(path, encoded, { contentType: "text/plain; charset=utf-8", upsert: true });
      if (upload.error) {
        problems.push(`'${attachment.title}': ${upload.error.message}`);
        continue;
      }

      const fields = {
        owner_id: owner.profileId,
        org_id: owner.orgId,
        type: ATTACHMENT_TYPES[attachment.kind] ?? workTypeForFile(attachment.title),
        source: `mcp:${vendor}`,
        source_vendor: vendor,
        orig_conversation_id: origId,
        title: attachment.title,
        content_ref: path,
        content_fidelity: "verbatim",
        ts_precision: "capture" as const,
        content_hash: await sha256Hex(attachment.content),
        source_meta: {
          ...sharedMeta,
          role: "attachment",
          kind: attachment.kind,
          language: attachment.language ?? null,
          filename: attachment.title,
        } as unknown as Json,
        meta: { assistant_transcribed: true },
      };

      const match = (existingAttachments ?? []).find((row) => row.title === attachment.title);
      const result = match
        ? await supabaseAdmin
            .from("work_items")
            .update(fields)
            .eq("id", match.id)
            .select("id")
            .maybeSingle()
        : await supabaseAdmin
            .from("work_items")
            .insert({ ...fields, visibility: "unmapped" })
            .select("id")
            .maybeSingle();
      if (result.error) problems.push(`'${attachment.title}': ${result.error.message}`);
      else {
        saved += 1;
        if (match?.id) capturedIds.push(match.id);
        else if (result.data?.id) capturedIds.push(result.data.id);
      }
    }
  }

  const { ensureExtracts } = await import("./extract.server");
  await ensureExtracts(capturedIds);

  await recordEvent(supabaseAdmin, {
    eventType: "mcp.push",
    orgId: owner.orgId,
    userId: owner.userId,
    dims: { vendor, attachment_count: attachmentBucket(attachments.length) },
  });
  await recordEvent(supabaseAdmin, {
    eventType: "workitem.captured",
    orgId: owner.orgId,
    userId: owner.userId,
    dims: { channel: "mcp", source: vendor },
  });

  const verb = existingThread ? "Updated" : "Saved";
  const tail = saved > 0 ? ` with ${saved} attachment${saved === 1 ? "" : "s"}` : "";
  const warn = problems.length > 0 ? ` Some attachments didn't save: ${problems.join("; ")}.` : "";
  return textResult(
    id,
    `${verb} '${title}' in Lasso (${messages.length} messages${tail}). It stays private until the user maps it.${warn}`,
  );
}
