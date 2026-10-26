import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveProfile } from "./profile-resolve";
import { generateShareToken, hashShareToken } from "./board-share.server";
import { SHARE_WINDOW_HOURS } from "./board-share-shared";
import { isEngagementEditor } from "./canvas-lab.server";
import { noteShareEvent, resolveShareToken } from "./board-share-open.server";
import { recordEvent } from "./telemetry.server";

type Db = SupabaseClient<Database>;
type Context = { supabase: Db; userId: string };
export type DocumentShareInput = { document_id: string; profile_id?: string };
export type CreateDocumentShareInput = DocumentShareInput & { expires_in_hours?: number };
export type RevokeDocumentShareInput = DocumentShareInput & { id: string };
export type DocumentCommentInput = { token: string; decision_id?: string; display_name?: string | null | undefined; body: string };
type CommentRow = Database["public"]["Tables"]["document_link_comments"]["Row"];

function bad(message: string): never { throw new Response(message, { status: 400 }); }
function forbidden(): never { throw new Response("Forbidden", { status: 403 }); }
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
const commentView = (row: CommentRow) => ({ id: row.id, decision_id: row.decision_id, display_name: row.display_name, body: row.body, created_at: row.created_at });

async function ownedDocument(context: Context, input: DocumentShareInput) {
  if (typeof input?.document_id !== "string" || !input.document_id.trim()) bad("A document is required.");
  const { data: document, error } = await context.supabase.from("work_items")
    .select("id, org_id, owner_id, doc_kind").eq("id", input.document_id).maybeSingle();
  check(error);
  if (!document || document.doc_kind !== "decisions") forbidden();
  const profile = await resolveProfile(context.supabase, context.userId, input.profile_id, document.org_id);
  if (!profile || profile.id !== document.owner_id) forbidden();
  return { document, profile };
}

export async function createDocumentShareLink(context: Context, input: CreateDocumentShareInput) {
  const { document, profile } = await ownedDocument(context, input);
  const hours = input.expires_in_hours ?? SHARE_WINDOW_HOURS;
  if (!Number.isFinite(hours) || hours <= 0 || hours > SHARE_WINDOW_HOURS) bad("Choose an expiry up to 48 hours.");
  const { data: nodes, error } = await context.supabase.from("workboard_nodes")
    .select("workboard_id").eq("work_item_id", document.id).is("deleted_at", null);
  check(error);
  let boardId: string | null = null;
  for (const id of [...new Set((nodes ?? []).map((node) => node.workboard_id))]) {
    const { data: board, error: boardError } = await context.supabase.from("workboards")
      .select("id, engagement_id").eq("id", id).maybeSingle();
    check(boardError);
    if (board && await isEngagementEditor(context.supabase, board.engagement_id, profile.id)) { boardId = board.id; break; }
  }
  if (!boardId) forbidden();
  const token = generateShareToken();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const { data: link, error: insertError } = await context.supabase.from("board_share_links").insert({
    workboard_id: boardId, work_item_id: document.id, org_id: document.org_id,
    created_by: profile.id, expires_at: expiresAt, token_hash: await hashShareToken(token),
  }).select("id").single();
  check(insertError);
  if (!link) throw new Error("The link could not be made.");
  await recordEvent(context.supabase, { eventType: "board.share_link", orgId: document.org_id,
    userId: context.userId, profileId: profile.id, dims: { action: "created", scope: "document" } });
  return { status: "created" as const, id: link.id, token, expiresAt };
}

export async function listDocumentShareLinks(context: Context, input: DocumentShareInput) {
  const { document } = await ownedDocument(context, input);
  const { data, error } = await context.supabase.from("board_share_links")
    .select("id, created_at, expires_at").eq("work_item_id", document.id)
    .is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  check(error);
  return data ?? [];
}

export async function revokeDocumentShareLink(context: Context, input: RevokeDocumentShareInput) {
  const { document, profile } = await ownedDocument(context, input);
  if (typeof input.id !== "string" || !input.id) bad("A link is required.");
  const { data, error } = await context.supabase.from("board_share_links")
    .update({ revoked_at: new Date().toISOString() }).eq("id", input.id)
    .eq("work_item_id", document.id).is("revoked_at", null).select("id").maybeSingle();
  check(error);
  if (!data) return { status: "not_found" as const };
  await recordEvent(context.supabase, { eventType: "board.share_link", orgId: document.org_id,
    userId: context.userId, profileId: profile.id, dims: { action: "revoked", scope: "document" } });
  return { status: "revoked" as const };
}

async function publicDocument(token: string) {
  const resolved = await resolveShareToken(token, true);
  if (resolved.status === "closed") return resolved;
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const documentId = resolved.link.work_item_id;
  if (!documentId) return { status: "closed", reason: "unknown" } as const;
  const { data: document, error } = await db.from("work_items")
    .select("id, org_id, title, display_title, captured_at, doc_kind").eq("id", documentId).maybeSingle();
  check(error);
  if (!document || document.doc_kind !== "decisions") {
    await noteShareEvent("refused", resolved.link.org_id, "unknown", "document");
    return { status: "closed", reason: "unknown" } as const;
  }
  return { ...resolved, db, document };
}

export async function openDocumentShareLink(input: { token: string }) {
  const resolved = await publicDocument(input?.token);
  if (resolved.status === "closed") return { status: "closed" as const, reason: resolved.reason };
  const { db, document } = resolved;
  const [lines, versions, comments] = await Promise.all([
    db.from("decisions").select("id, ord, call_text, why, status, srcs").eq("document_id", document.id).order("ord", { ascending: true }),
    db.from("document_versions").select("created_at").eq("work_item_id", document.id).order("created_at", { ascending: false }).limit(1),
    db.from("document_link_comments").select("id, decision_id, display_name, body, created_at").eq("work_item_id", document.id).order("created_at", { ascending: true }),
  ]);
  check(lines.error); check(versions.error); check(comments.error);
  const statusWords = { draft: "open", confirmed: "agreed", discarded: "dropped" } as const;
  await resolved.incrementOpened();
  await noteShareEvent("opened", document.org_id, undefined, "document");
  return {
    title: document.display_title ?? document.title,
    updated_at: versions.data?.[0]?.created_at ?? document.captured_at,
    lines: (lines.data ?? []).map((line) => ({ id: line.id, ord: line.ord, statement: line.call_text,
      reason: line.why, status: statusWords[line.status],
      has_source: Array.isArray(line.srcs) && line.srcs.some((source) => source !== null && typeof source === "object" && !Array.isArray(source) && typeof source["turn"] === "number"),
    })),
    comments: (comments.data ?? []).map((row) => ({ id: row.id, decision_id: row.decision_id, display_name: row.display_name, body: row.body, created_at: row.created_at })),
  };
}

export async function addDocumentLinkComment(input: DocumentCommentInput) {
  const resolved = await publicDocument(input?.token);
  if (resolved.status === "closed") return { status: "closed" as const, message: "This link has expired." };
  const { db, document, link } = resolved;
  if (typeof input.body !== "string") bad("Write a comment of 1 to 2000 characters.");
  const body = input.body.trim();
  if (!body || body.length > 2000) bad("Write a comment of 1 to 2000 characters.");
  if (input.display_name != null && typeof input.display_name !== "string") bad("Use a name of up to 60 characters.");
  const displayName = input.display_name?.trim() || null;
  if (displayName && displayName.length > 60) bad("Use a name of up to 60 characters.");
  const decisionId = input.decision_id ?? null;
  if (decisionId !== null) {
    if (typeof decisionId !== "string" || !decisionId) bad("Choose a line in this document.");
    const { data, error } = await db.from("decisions").select("id").eq("id", decisionId).eq("document_id", document.id).maybeSingle();
    check(error);
    if (!data) bad("Choose a line in this document.");
  }
  const { count, error: countError } = await db.from("document_link_comments")
    .select("id", { count: "exact", head: true }).eq("share_link_id", link.id)
    .gte("created_at", new Date(Date.now() - 60 * 60 * 1000).toISOString());
  check(countError);
  if (count === null) throw new Error("The comment could not be added.");
  if (count >= 30) return { status: "refused" as const, message: "Too many comments. Please try again later." };
  const { data, error } = await db.from("document_link_comments").insert({ work_item_id: document.id,
    decision_id: decisionId, share_link_id: link.id, display_name: displayName, body }).select("*").single();
  check(error);
  if (!data) throw new Error("The comment could not be added.");
  await recordEvent(db, { eventType: "decisions_doc.link_comment_added", orgId: document.org_id,
    userId: null, dims: { has_name: displayName !== null, on_line: decisionId !== null } });
  return commentView(data);
}