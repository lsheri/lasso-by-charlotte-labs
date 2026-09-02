// Server-only MCP endpoint logic. Token in URL path, service-role scoped writes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import { sha256Hex } from "@/lib/connectors-shared";
import {
  attachmentRejection,
  flaggedBucket,
  REJECTION_WORDS,
  type RejectionReason,
} from "@/lib/attachment-guard";
import { workTypeForFile } from "@/lib/work-types";
import { recordEvent } from "@/lib/telemetry.server";
import { noteModelUsed, noteThreadShape } from "@/lib/work-taxonomy.server";
import { clientDisplayName, engagementDisplayTitle, isQuickFolder } from "@/lib/clients";
import {
  ATTACHMENT_KINDS,
  CONVERSATION_VENDORS,
  attachmentBucket,
  type SourceMeta,
} from "@/lib/conversation-shared";
import { safeChatUrl } from "@/lib/chat-url";
import { CANONICAL_ORIGIN } from "@/lib/app-host";

const PROTOCOL_VERSION = "2025-11-25";
const ACCEPTED_PROTOCOLS = new Set([
  PROTOCOL_VERSION,
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
]);
const MAX_TURNS = 500;
const MAX_THREAD_BYTES = 2 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const MAX_ATTACHMENTS = 12;
/** A re-push may improve the record; it may never shrink it silently. */
const SHRINK_RATIO = 0.6;
const SHRINK_FLOOR = 200;

function looksCondensed(incomingChars: number, storedChars: number): boolean {
  return storedChars > SHRINK_FLOOR && incomingChars < storedChars * SHRINK_RATIO;
}

// Contract surface: external MCP clients read this. Canonical host only.
const SITE_URL = CANONICAL_ORIGIN;
const ICONS = [
  { src: `${SITE_URL}/mcp-icon-256.png`, mimeType: "image/png", sizes: ["256x256"] },
  { src: `${SITE_URL}/mcp-icon-48.png`, mimeType: "image/png", sizes: ["48x48"] },
];

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

/**
 * Pass 155. What the pushing client said about itself during the initialize
 * handshake: machine-generated name, version and protocol strings only. Kept
 * in process memory and read back on the following tool call; a cold worker
 * simply reports "unknown".
 */
type ClientIdentity = { name: string; version: string; protocol: string };
const CLIENT_IDENTITIES = new Map<string, ClientIdentity>();

function rememberClient(tokenId: string, identity: ClientIdentity): void {
  if (CLIENT_IDENTITIES.size > 500) CLIENT_IDENTITIES.clear();
  CLIENT_IDENTITIES.set(tokenId, identity);
}

function clientIdentity(tokenId: string, headerProtocol: string | null): ClientIdentity {
  const stored = CLIENT_IDENTITIES.get(tokenId);
  return {
    name: stored?.name ?? "unknown",
    version: stored?.version ?? "unknown",
    protocol: headerProtocol ?? stored?.protocol ?? "unknown",
  };
}

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

const CHAT_URL_FIELD = {
  type: "string",
  description:
    "Optional. The https URL of this conversation in the source app, if you can see it. Stored only for claude.ai, chatgpt.com, chat.openai.com and gemini.google.com; anything else is ignored.",
};

const TOOLS = [
  {
    name: "push_conversation",
    title: "Push a conversation",
    icons: ICONS,
    description:
      "When the user says 'Push to Lasso', 'send to Lasso', or similar: call push_conversation with the ENTIRE conversation, every message, verbatim, unabridged, plus any artifact, canvas or file that already existed as its own object in this app, as attachments. Never summarize the transcript. Never compose new summaries, recaps or section write-ups and send them as attachments. Never use push_document for conversation artifacts. Verbatim is non-negotiable: never substitute a summary, paraphrase, or shortened version of a message at any position, the server rejects shrunken overwrites. Before pushing, assess how many messages you can reproduce word-for-word in a single call given their actual lengths. If the whole conversation fits, push it whole. If not, push it in consecutive windows using window {from, to, total}: start with the first window sized to what you can reproduce verbatim, then follow the server's response, which tells you the next starting position, until all messages are stored. When re-pushing a conversation that grew, push only the new messages as a window, never re-send earlier messages unless correcting them. A smaller window is always the answer; a shorter message never is.",
    // Windowing is the only sanctioned way to split a push, and only because
    // the alternative the model reaches for otherwise is shortening messages.
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
            "Stable ID for the source thread; all pushes for the same conversation MUST reuse it. Use the source app's REAL conversation UUID when it is visible to you (it appears in the chat's URL). If you cannot see it, use any stable id — but then also pass source_url if the user can supply the conversation's URL.",
        },
        source_url: {
          type: "string",
          description:
            "The conversation's URL in the source app, if you can see it. This is the most stable way to recognise the same conversation later.",
        },
        chat_url: CHAT_URL_FIELD,
        messages: {
          type: "array",
          maxItems: MAX_TURNS,
          description:
            "Messages in order, complete and verbatim. Without window, this must be the whole conversation starting at message 1. With window {from, to, total}, this is exactly the messages for positions from..to of a long conversation, still complete and verbatim. Include timestamps ONLY if actually known from the source; NEVER invent timestamps.",
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
            "ONLY objects that already existed as a separate, addressable thing in the source app before this push: a Claude artifact, a ChatGPT canvas, a generated or downloadable file. Each one must carry its own source_artifact_id from that app. The server rejects attachments that duplicate message content. Rejected content is still captured in the transcript.",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: [...ATTACHMENT_KINDS] },
              title: {
                type: "string",
                description:
                  "The artifact's own title exactly as it appeared in the source app, verbatim. Never a description you invent for it, and never a heading you compose to label it.",
              },
              source_artifact_id: {
                type: "string",
                description:
                  "The artifact's own identifier in the source app, exactly as the app knows it. In Claude this is the artifact's identifier. In ChatGPT it is the canvas or textdoc id. For a generated file it is the filename the app gave it. This is not a description and not a slug you invent. If the object does not have an identifier of its own in the app, it is not an artifact and must not be sent as an attachment.",
              },
              content: { type: "string", description: "Verbatim source or text." },
              language: { type: "string" },
            },
            required: ["kind", "title", "content", "source_artifact_id"],
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
        window: {
          type: "object",
          description:
            "Use for long conversations you cannot reproduce verbatim in one call. 1-indexed and inclusive: messages[i] is conversation position from+i. Windows must be consecutive with no gaps; the server tells you the next starting position.",
          properties: {
            from: { type: "integer", description: "Position of the first message in this call." },
            to: { type: "integer", description: "Position of the last message in this call." },
            total: {
              type: "integer",
              description: "Total number of messages in the whole conversation. Required.",
            },
          },
          required: ["from", "to", "total"],
        },
      },
      required: ["title", "vendor", "orig_conversation_id", "messages"],
    },
  },
  {
    name: "push_thread",
    title: "Push a transcript",
    icons: ICONS,
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
        chat_url: CHAT_URL_FIELD,
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
    title: "Push a document",
    icons: ICONS,
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
    title: "List engagements",
    icons: ICONS,
    description:
      "List the user's engagements and workstreams so a pushed item can mention where it might belong. Read-only.",
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
    const info = (params["clientInfo"] ?? {}) as Obj;
    rememberClient(owner.tokenId, {
      name: machineLabel(info["name"]),
      version: machineLabel(info["version"]),
      protocol: machineLabel(asked),
    });
    return rpcResult(id, {
      protocolVersion: ACCEPTED_PROTOCOLS.has(asked) ? asked : PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: {
        name: "lasso",
        title: "Lasso by Charlotte Labs",
        version: "1.1.0",
        websiteUrl: SITE_URL,
        icons: ICONS,
      },
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
    const client = clientIdentity(
      owner.tokenId,
      machineLabel(request.headers.get("mcp-protocol-version")) === "unknown"
        ? null
        : machineLabel(request.headers.get("mcp-protocol-version")),
    );
    try {
      if (name === "push_conversation") return await pushConversation(owner, args, id, client);
      if (name === "push_thread") return await pushThread(owner, args, id, client);
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

async function pushThread(
  owner: Owner,
  args: Obj,
  id: unknown,
  client: ClientIdentity = { name: "unknown", version: "unknown", protocol: "unknown" },
): Promise<Response> {
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
      ...(safeChatUrl(args["chat_url"]) ? { source_meta: { url: safeChatUrl(args["chat_url"])! } } : {}),
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
  const threadActor = { orgId: owner.orgId, userId: owner.userId, profileId: owner.profileId };
  await noteModelUsed(supabaseAdmin, threadActor, {
    item: { type: "ai_thread", source: `mcp:${sourceAi}` },
    via: "mcp_push",
    turnCount: turns.length,
    modelRaws: [args["model"]],
  });
  await noteThreadShape(
    supabaseAdmin,
    threadActor,
    turns.map((t) => ({ role: t.role, length: t.content.length })),
  );
  const { noteCaptureContext } = await import("./capture-census.server");
  await noteCaptureContext(supabaseAdmin, threadActor, {
    turns: turns.map((t) => ({ role: t.role, content: t.content, ts: t.ts ?? null })),
    clientName: client.name,
    clientVersion: client.version,
    protocolVersion: client.protocol,
    bytes,
  });
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
  const { data: doc, error } = await supabaseAdmin
    .from("work_items")
    .insert({
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
  await noteModelUsed(
    supabaseAdmin,
    { orgId: owner.orgId, userId: owner.userId, profileId: owner.profileId },
    { item: { type: workTypeForFile(safe), source: "mcp:push" }, via: "mcp_push" },
  );
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
    .select("id, code, title, client_label, clients(id, name, quick_folder)")
    .in("id", ids);
  const { data: tasks } = await supabaseAdmin
    .from("tasks")
    .select("engagement_id, name")
    .in("engagement_id", ids);

  const lines = (engagements ?? []).map((row) => {
    const e = row as unknown as {
      id: string;
      code: string;
      title: string;
      client_label: string | null;
      clients: { name: string; quick_folder: boolean } | null;
    };
    const names = (tasks ?? []).filter((t) => t.engagement_id === e.id).map((t) => `  - ${t.name}`);
    const header = isQuickFolder(e)
      ? `${engagementDisplayTitle(e)} (folder)`
      : `${e.code}, ${e.title}${clientDisplayName(e) ? ` for ${clientDisplayName(e)}` : ""}`;
    return [header, ...(names.length ? names : ["  (no workstreams yet)"])].join("\n");
  });
  await logPush(owner, { tool: "list_engagements" });
  return textResult(id, lines.join("\n\n"));
}

type IncomingMessage = { role: string; content: string; timestamp?: string };
type IncomingAttachment = {
  kind: string;
  title: string;
  content: string;
  sourceArtifactId: string;
  language?: string;
};

type RejectedAttachment = {
  title: string;
  kind: string;
  reason: RejectionReason;
  chars: number;
  source_artifact_id: string;
};

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

/** Size of the stored version of a known attachment, 0 when it cannot be read. */
async function storedAttachmentChars(match: {
  content_ref: string | null;
  source_meta: unknown;
}): Promise<number> {
  const meta =
    match.source_meta && typeof match.source_meta === "object"
      ? (match.source_meta as { chars?: unknown })
      : null;
  if (typeof meta?.chars === "number" && meta.chars > 0) return meta.chars;
  if (!match.content_ref) return 0;
  const { data } = await supabaseAdmin.storage.from("work-files").download(match.content_ref);
  return data ? data.size : 0;
}

/**
 * The canonical push. One call = one conversation: a transcript work item plus
 * one work item per attachment, all sharing orig_conversation_id so the app can
 * render them as a single group. Re-pushing the same conversation updates in
 * place rather than duplicating.
 */
async function pushConversation(
  owner: Owner,
  args: Obj,
  id: unknown,
  client: ClientIdentity = { name: "unknown", version: "unknown", protocol: "unknown" },
): Promise<Response> {
  const title = typeof args["title"] === "string" ? args["title"].trim() : "";
  if (!title) return rpcError(id, -32602, "title is required, verbatim from the source app");

  const vendor = CONVERSATION_VENDORS.includes(String(args["vendor"]) as never)
    ? String(args["vendor"])
    : "other";

  const origId =
    typeof args["orig_conversation_id"] === "string" ? args["orig_conversation_id"].trim() : "";
  if (!origId) return rpcError(id, -32602, "orig_conversation_id is required");

  const sourceUrl =
    typeof args["source_url"] === "string" && args["source_url"].trim()
      ? args["source_url"].trim()
      : null;

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

  // ---- optional window: this call covers positions from..to of the whole thread
  const rawWindow = args["window"];
  let win: { from: number; to: number; total: number } | null = null;
  if (rawWindow && typeof rawWindow === "object" && !Array.isArray(rawWindow)) {
    const w = rawWindow as { from?: unknown; to?: unknown; total?: unknown };
    const from = Number(w.from);
    const to = Number(w.to);
    const total = Number(w.total);
    if (!Number.isInteger(total) || total < 1) {
      return rpcError(id, -32602, "window.total is required: the full conversation length.");
    }
    if (!Number.isInteger(from) || from < 1) {
      return rpcError(id, -32602, "window.from must be an integer of at least 1.");
    }
    if (!Number.isInteger(to) || to < from) {
      return rpcError(id, -32602, "window.to must be an integer greater than or equal to from.");
    }
    if (messages.length !== to - from + 1) {
      return rpcError(
        id,
        -32602,
        `window covers ${to - from + 1} positions but ${messages.length} messages were sent. Send exactly the messages for positions ${from} to ${to}.`,
      );
    }
    win = { from, to, total };
  }

  const rawAttachments = Array.isArray(args["attachments"])
    ? (args["attachments"] as (Partial<IncomingAttachment> & { source_artifact_id?: unknown })[])
    : [];
  if (rawAttachments.length > MAX_ATTACHMENTS) {
    return rpcError(
      id,
      -32602,
      `Too many attachments (${rawAttachments.length}). Maximum is ${MAX_ATTACHMENTS}. Send only objects that already existed in the app as their own artifact, canvas or file.`,
    );
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
      sourceArtifactId:
        typeof a.source_artifact_id === "string" ? a.source_artifact_id.trim() : "",
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
  const chatUrl = safeChatUrl(args["chat_url"]);
  const sharedMeta: SourceMeta = {
    vendor,
    model,
    ...(chatUrl ? { url: chatUrl } : {}),
    ...(Array.isArray(metaIn.skills_used)
      ? { skills_used: metaIn.skills_used.filter((s): s is string => typeof s === "string") }
      : {}),
    ...(typeof metaIn.thinking_level === "string" ? { thinking_level: metaIn.thinking_level } : {}),
    ...(typeof metaIn.research_mode === "string" ? { research_mode: metaIn.research_mode } : {}),
    ...(typeof metaIn.notes === "string" ? { notes: metaIn.notes } : {}),
  };

  // ---- locate the existing thread: source_url, then orig id, then continuation
  let existingThread: { id: string; meta: unknown } | null = null;
  if (sourceUrl) {
    const { data } = await supabaseAdmin
      .from("work_items")
      .select("id, meta")
      .eq("owner_id", owner.profileId)
      .eq("type", "ai_thread")
      .eq("meta->>source_url", sourceUrl)
      .maybeSingle();
    existingThread = data ?? null;
  }
  if (!existingThread) {
    const { data } = await supabaseAdmin
      .from("work_items")
      .select("id, meta")
      .eq("owner_id", owner.profileId)
      .eq("orig_conversation_id", origId)
      .eq("type", "ai_thread")
      .maybeSingle();
    existingThread = data ?? null;
  }

  // Continuation hint only. We never merge threads, we just teach the caller the stable key.
  let continuationOrigId: string | null = null;
  if (!existingThread) {
    const firstUser = messages.find((m) => m.role === "user");
    if (firstUser) {
      const firstHash = await sha256Hex(firstUser.content);
      const { data: matchTurns } = await supabaseAdmin
        .from("turns")
        .select("work_item_id")
        .eq("role", "user")
        .eq("content_hash", firstHash)
        .limit(25);
      const ids = (matchTurns ?? []).map((t) => t.work_item_id).filter(Boolean);
      if (ids.length > 0) {
        const { data: candidates } = await supabaseAdmin
          .from("work_items")
          .select("orig_conversation_id")
          .in("id", ids)
          .eq("owner_id", owner.profileId)
          .eq("type", "ai_thread")
          .eq("source_vendor", vendor)
          .limit(1);
        continuationOrigId = candidates?.[0]?.orig_conversation_id ?? null;
      }
    }
  }

  const priorThreadMeta =
    existingThread?.meta && typeof existingThread.meta === "object" && !Array.isArray(existingThread.meta)
      ? (existingThread.meta as Record<string, unknown>)
      : {};
  const priorExpectedTotal =
    typeof priorThreadMeta["expected_total"] === "number"
      ? (priorThreadMeta["expected_total"] as number)
      : null;
  const expectedTotal = win?.total ?? priorExpectedTotal;

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
    meta: {
      ...priorThreadMeta,
      assistant_transcribed: true,
      ...(sourceUrl ? { source_url: sourceUrl } : {}),
      ...(expectedTotal ? { expected_total: expectedTotal } : {}),
    } as unknown as Json,
  };

  let threadId: string;
  if (existingThread) {
    threadId = existingThread.id;
    const { error } = await supabaseAdmin
      .from("work_items")
      .update(threadFields)
      .eq("id", threadId);
    if (error) return rpcError(id, -32603, error.message);
  } else {
    const { data, error } = await supabaseAdmin
      .from("work_items")
      .insert({ ...threadFields, visibility: "unmapped" })
      .select("id")
      .single();
    if (error || !data) return rpcError(id, -32603, error?.message ?? "Could not save it");
    threadId = data.id;
  }

  // ---- reconcile turns: append-only, never delete -------------------------
  const { data: storedTurns, error: storedError } = await supabaseAdmin
    .from("turns")
    .select("id, turn_no, role, content, content_hash, meta")
    .eq("work_item_id", threadId)
    .order("turn_no", { ascending: true });
  if (storedError) return rpcError(id, -32603, storedError.message);
  const stored = new Map(
    (storedTurns ?? []).map((t) => [
      t.turn_no,
      { id: t.id, role: t.role, content: t.content, content_hash: t.content_hash, meta: t.meta },
    ]),
  );
  const storedBefore = storedTurns?.length ?? 0;

  // No gaps: a window may correct stored positions or continue from the end,
  // never start past it, or the record would have a hole in the middle.
  if (win && win.from > storedBefore + 1) {
    return rpcError(
      id,
      -32602,
      `That window starts at message ${win.from} but only ${storedBefore} message${storedBefore === 1 ? " is" : "s are"} stored, which would leave a gap. Start the next window at message ${storedBefore + 1}.`,
    );
  }
  const offset = win ? win.from - 1 : 0;

  let unchangedCount = 0;
  let changedCount = 0;
  const newRows: Record<string, unknown>[] = [];
  const degradedTurns: { turn_no: number; stored_chars: number; incoming_chars: number }[] = [];

  for (let i = 0; i < messages.length; i += 1) {
    const m = messages[i]!;
    const turnNo = offset + i + 1;
    const hash = await sha256Hex(m.content);
    const prior = stored.get(turnNo);
    if (!prior) {
      newRows.push({
        work_item_id: threadId,
        turn_no: turnNo,
        role: m.role as "user" | "assistant" | "tool",
        content: m.content,
        content_hash: hash,
        ts: m.timestamp ?? null,
        ts_precision: (m.timestamp ? "source" : "capture") as "source" | "capture",
        ...(model ? { model } : {}),
        meta: {},
      });
      continue;
    }
    if (prior.content_hash === hash) {
      unchangedCount += 1;
      continue;
    }
    // A re-push may improve a turn; it may not quietly replace verbatim with
    // a condensed retelling. We keep what we have and say so.
    const storedChars = (prior.content ?? "").length;
    if (looksCondensed(m.content.length, storedChars)) {
      degradedTurns.push({
        turn_no: turnNo,
        stored_chars: storedChars,
        incoming_chars: m.content.length,
      });
      continue;
    }
    // Edited or branched upstream: update in place so the turn id survives.
    const priorMeta =
      prior.meta && typeof prior.meta === "object" && !Array.isArray(prior.meta)
        ? (prior.meta as Record<string, unknown>)
        : {};
    // Preserve the prior version before overwriting it. If that fails, the
    // overwrite does not happen: no version is lost without a copy first.
    const { error: revError } = await supabaseAdmin.from("turn_revisions").insert({
      turn_id: prior.id,
      work_item_id: threadId,
      turn_no: turnNo,
      role: String(prior.role),
      content: prior.content ?? "",
      content_hash: prior.content_hash,
      replaced_at: new Date().toISOString(),
    });
    if (revError) {
      return rpcError(
        id,
        -32603,
        `Could not preserve the previous version of message ${turnNo}, so it was not overwritten: ${revError.message}`,
      );
    }
    const { error: updError } = await supabaseAdmin
      .from("turns")
      .update({
        role: m.role as "user" | "assistant" | "tool",
        content: m.content,
        content_hash: hash,
        ts: m.timestamp ?? null,
        ts_precision: (m.timestamp ? "source" : "capture") as "source" | "capture",
        ...(model ? { model } : {}),
        meta: {
          ...priorMeta,
          revised_at: new Date().toISOString(),
          previous_content_hash: prior.content_hash,
        } as unknown as Json,
      })
      .eq("id", prior.id);
    if (updError) return rpcError(id, -32603, updError.message);
    changedCount += 1;
  }

  if (newRows.length > 0) {
    const { error: turnsError } = await supabaseAdmin.from("turns").insert(newRows as never);
    if (turnsError) return rpcError(id, -32603, turnsError.message);
  }

  const storedCount = storedBefore + newRows.length;
  const extraStored = win ? 0 : Math.max(0, storedBefore - messages.length);

  // ---- attachments (match by source_artifact_id, then title) ---------------
  let saved = 0;
  const capturedIds: string[] = [threadId];
  /** Pass 148: model.used fires once per NEW row, never on an update. */
  const createdAttachmentTypes: string[] = [];
  const problems: string[] = [];
  const rejected: RejectedAttachment[] = [];
  const degradedAttachments: { title: string; stored_chars: number; incoming_chars: number }[] = [];
  const transcriptText = messages.map((m) => m.content).join("\n\n");
  const messageTexts = messages.map((m) => m.content);
  if (attachments.length > 0 && !owner.userId) {
    problems.push("attachments need a signed-in workspace account");
  } else {
    const { data: existingAttachments } = await supabaseAdmin
      .from("work_items")
      .select("id, title, content_ref, source_meta")
      .eq("owner_id", owner.profileId)
      .eq("orig_conversation_id", origId)
      .neq("type", "ai_thread");

    for (const attachment of attachments) {
      // The server decides what an artifact is. Every rejected attachment's
      // content is already stored verbatim in the transcript, so rejecting it
      // removes a duplicate row, not information.
      const reason = attachmentRejection(attachment, messageTexts, transcriptText);
      if (reason) {
        rejected.push({
          title: attachment.title,
          kind: attachment.kind,
          reason,
          chars: attachment.content.length,
          source_artifact_id: attachment.sourceArtifactId,
        });
        continue;
      }
      const encoded = new TextEncoder().encode(attachment.content);
      if (encoded.byteLength > MAX_DOC_BYTES) {
        problems.push(`'${attachment.title}' is over the 5MB limit`);
        continue;
      }
      // Match on the artifact's own id first, so a rename in the source app
      // follows through instead of creating a second row.
      const match =
        (existingAttachments ?? []).find(
          (row) =>
            ((row.source_meta as { source_artifact_id?: string } | null)?.source_artifact_id ??
              "") === attachment.sourceArtifactId,
        ) ?? (existingAttachments ?? []).find((row) => row.title === attachment.title);
      // Same guard as turns: a known artifact can grow or be edited, but a
      // condensed replacement is a loss, so the stored version stays.
      if (match) {
        const storedChars = await storedAttachmentChars(match);
        if (storedChars > 0 && looksCondensed(attachment.content.length, storedChars)) {
          degradedAttachments.push({
            title: attachment.title,
            stored_chars: storedChars,
            incoming_chars: attachment.content.length,
          });
          continue;
        }
      }
      // Reuse the stored path for a known attachment; give new ones a collision-proof suffix.
      const suffix = (await sha256Hex(attachment.sourceArtifactId)).slice(0, 8);
      const path =
        match?.content_ref ??
        `${owner.userId}/conv-${slugify(origId)}-${slugify(attachment.title)}-${suffix}`;
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
          source_artifact_id: attachment.sourceArtifactId,
          chars: attachment.content.length,
          duplicate_of_transcript: false,
        } as unknown as Json,
        meta: { assistant_transcribed: true },
      };

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
        else if (result.data?.id) {
          capturedIds.push(result.data.id);
          createdAttachmentTypes.push(String(fields.type));
        }
      }
    }
  }

  const { ensureExtracts } = await import("./extract.server");
  await ensureExtracts(capturedIds);

  // The transcript carries the record of what was refused, replaced each push.
  await supabaseAdmin
    .from("work_items")
    .update({
      source_meta: {
        ...sharedMeta,
        role: "transcript",
        rejected_attachments: rejected,
      } as unknown as Json,
    })
    .eq("id", threadId);

  const pushMode = !existingThread
    ? "created"
    : newRows.length > 0 || changedCount > 0
      ? "appended"
      : "unchanged";

  await recordEvent(supabaseAdmin, {
    eventType: "mcp.push",
    orgId: owner.orgId,
    userId: owner.userId,
    dims: {
      vendor,
      attachment_count: attachmentBucket(attachments.length),
      rejected_attachments: flaggedBucket(rejected.length),
      mode: pushMode,
      windowed: win ? "yes" : "no",
      degraded_refusals: flaggedBucket(degradedTurns.length + degradedAttachments.length),
    },
  });
  await recordEvent(supabaseAdmin, {
    eventType: "workitem.captured",
    orgId: owner.orgId,
    userId: owner.userId,
    dims: { channel: "mcp", source: vendor },
  });

  // Pass 148. The tool and the coarse shape of the work, once per new row; a
  // re-push of an unchanged item adds nothing. The thread's shape is emitted
  // every push, because the shape is what changed.
  const taxonomyActor = {
    orgId: owner.orgId,
    userId: owner.userId,
    profileId: owner.profileId,
  };
  const { data: shapeTurns } = await supabaseAdmin
    .from("turns")
    .select("role, content, model")
    .eq("work_item_id", threadId)
    .order("turn_no", { ascending: true });
  // Pass 155: the exact machine identifiers seen anywhere in this conversation.
  const modelRaws = [model, ...(shapeTurns ?? []).map((t) => (t as { model?: unknown }).model)];
  if (pushMode === "created") {
    await noteModelUsed(supabaseAdmin, taxonomyActor, {
      item: { type: "ai_thread", source: `mcp:${vendor}`, source_vendor: vendor },
      via: "mcp_push",
      turnCount: messages.length,
      modelRaws,
    });
  }
  for (const type of createdAttachmentTypes) {
    await noteModelUsed(supabaseAdmin, taxonomyActor, {
      item: { type, source: `mcp:${vendor}`, source_vendor: vendor },
      via: "mcp_push",
      modelRaws,
    });
  }
  await noteThreadShape(
    supabaseAdmin,
    taxonomyActor,
    (shapeTurns ?? []).map((t) => ({ role: String(t.role), length: (t.content ?? "").length })),
  );
  // Pass 155: one capture.context per NEW conversation, never on a re-push.
  if (pushMode === "created") {
    const { noteCaptureContext } = await import("./capture-census.server");
    await noteCaptureContext(supabaseAdmin, taxonomyActor, {
      turns: messages.map((m) => ({
        role: m.role,
        content: m.content,
        ts: m.timestamp ?? null,
      })),
      clientName: client.name,
      clientVersion: client.version,
      protocolVersion: client.protocol,
      bytes: new TextEncoder().encode(serialized).byteLength,
    });
  }

  if (owner.userId) {
    // The canonical record of the push. Exact counts, no content.
    const { recordEventV2 } = await import("./telemetry-v2.server");
    if (pushMode === "created") {
      await recordEventV2(supabaseAdmin, owner.userId, {
        eventName: "conversation.pushed",
        props: { tool: vendor, turn_count: messages.length, attachment_count: attachments.length },
        profileId: owner.profileId,
        workItemId: threadId,
      });
    } else if (pushMode === "appended") {
      if (newRows.length > 0) {
        await recordEventV2(supabaseAdmin, owner.userId, {
          eventName: "conversation.appended",
          props: { tool: vendor, turn_count: newRows.length },
          profileId: owner.profileId,
          workItemId: threadId,
        });
      }
      if (changedCount > 0) {
        await recordEventV2(supabaseAdmin, owner.userId, {
          eventName: "conversation.turn_revised",
          props: { tool: vendor, turn_count: changedCount },
          profileId: owner.profileId,
          workItemId: threadId,
        });
      }
    }
  }

  const verb = existingThread ? "Updated" : "Saved";
  const tail = saved > 0 ? ` with ${saved} attachment${saved === 1 ? "" : "s"}` : "";
  const warn = problems.length > 0 ? ` Some attachments didn't save: ${problems.join("; ")}.` : "";
  const rejectedNote =
    rejected.length > 0
      ? ` Did not create ${rejected.length} separate item${rejected.length === 1 ? "" : "s"}: ${rejected
          .map((r) => `'${r.title}' ${REJECTION_WORDS[r.reason]}`)
          .join(
            "; ",
          )}. All of it is already stored word for word in the transcript, so nothing was lost. Only send objects that existed in the app before the push, with their own identifier.`
      : "";
  const counts = existingThread
    ? ` ${unchangedCount} message${unchangedCount === 1 ? "" : "s"} already captured, ${newRows.length} new, ${changedCount} changed since last push.`
    : ` ${messages.length} message${messages.length === 1 ? "" : "s"} captured.`;
  const shortNote =
    extraStored > 0
      ? " This push had fewer messages than what is already stored. Nothing was removed."
      : "";
  const degradedNote =
    degradedTurns.length > 0
      ? ` Kept the stored verbatim version of ${degradedTurns.length} message${degradedTurns.length === 1 ? "" : "s"} (position${degradedTurns.length === 1 ? "" : "s"} ${degradedTurns
          .map((d) => d.turn_no)
          .join(
            ", ",
          )}) because the incoming version looked condensed. Re-push those positions verbatim in a smaller window.`
      : "";
  const degradedAttachmentNote =
    degradedAttachments.length > 0
      ? ` Kept the stored version of ${degradedAttachments.length} attachment${degradedAttachments.length === 1 ? "" : "s"} (${degradedAttachments
          .map((a) => `'${a.title}'`)
          .join(", ")}) because the incoming version looked condensed. Re-send it in full.`
      : "";
  const total = expectedTotal;
  const cursor = total
    ? storedCount >= total
      ? ` All ${total} messages captured.`
      : ` Stored ${storedCount} of ${total} messages. Continue with a window starting at message ${storedCount + 1}.`
    : "";
  const continuation = continuationOrigId
    ? ` This looks like a continuation of an existing conversation in Lasso. To keep them together next time, reuse orig_conversation_id '${continuationOrigId}'.`
    : "";
  return textResult(
    id,
    `${verb} '${title}' in Lasso${tail}.${counts}${shortNote}${degradedNote}${degradedAttachmentNote}${cursor} It stays private until the user maps it.${rejectedNote}${warn}${continuation}`,
  );
}
