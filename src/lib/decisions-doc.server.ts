import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { resolveProfile } from "./profile-resolve";
import { recordEvent } from "./telemetry.server";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";
import { renderDecisionsMarkdown } from "./mcp-decisions";
import { recordNewVersion } from "./connector-import.server";

type Db = SupabaseClient<Database>;
type Row = Database["public"]["Tables"]["decisions"]["Row"];
type Status = Row["status"];
type Context = { supabase: Db; userId: string };
export type DecisionDocumentInput = { document_id: string; profile_id?: string };
export type DecisionLinePatch = { call_text?: string; why?: string; status?: Status };
export type UpdateDecisionLineInput = DecisionDocumentInput & { id: string; patch: DecisionLinePatch };
export type AddDecisionLineInput = DecisionDocumentInput & { call_text: string; why?: string; status?: Status };
export type RemoveDecisionLineInput = DecisionDocumentInput & { id: string };
export type RestoreDecisionLineInput = DecisionDocumentInput & { row: Row };
export type ReorderDecisionLinesInput = DecisionDocumentInput & { ids_in_order: string[] };
export type SetDecisionPointerInput = DecisionDocumentInput & { id: string; turn: number | null };

function bad(message: string): never { throw new Response(message, { status: 400 }); }
export function validateDecisionDocumentInput<T extends DecisionDocumentInput>(input: T): T {
  if (!input || typeof input.document_id !== "string" || !input.document_id.trim()) bad("document_id is required");
  return input;
}
function validatePatch(patch: DecisionLinePatch): DecisionLinePatch {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) bad("patch is required");
  const out: DecisionLinePatch = {};
  if (patch.call_text !== undefined) {
    if (typeof patch.call_text !== "string" || !patch.call_text.trim() || patch.call_text.trim().length > 400) bad("call_text must be non-empty and at most 400 characters");
    out.call_text = patch.call_text.trim();
  }
  if (patch.why !== undefined) {
    if (typeof patch.why !== "string" || patch.why.length > 1000) bad("why must be a string of at most 1000 characters");
    out.why = patch.why;
  }
  if (patch.status !== undefined) {
    if (patch.status !== "draft" && patch.status !== "confirmed" && patch.status !== "discarded") bad("status must be draft, confirmed or discarded");
    out.status = patch.status;
  }
  return out;
}
const words = { draft: "open", confirmed: "agreed", discarded: "dropped" };

async function ownedDocument(context: Context, input: DecisionDocumentInput) {
  validateDecisionDocumentInput(input);
  const { supabase, userId } = context;
  const profile = await resolveProfile(supabase, userId, input.profile_id ?? null);
  if (!profile) throw new Response("Forbidden", { status: 403 });
  const { data: document, error } = await supabase.from("work_items")
    .select("id, owner_id, org_id, doc_kind, title, parent_work_item_id, content_ref, content_hash, captured_at, source_meta")
    .eq("id", input.document_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!document || document.owner_id !== profile.id || document.doc_kind !== "decisions") throw new Response("Forbidden", { status: 403 });
  const event = (eventType: TelemetryEvent, dims: TelemetryDims) => recordEvent(supabase, {
    eventType, orgId: profile.org_id, userId, profileId: profile.id, dims,
  });
  return { document, profile, event };
}

async function lineById(db: Db, documentId: string, id: string) {
  if (typeof id !== "string" || !id) bad("id is required");
  const { data, error } = await db.from("decisions").select("*").eq("document_id", documentId).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) bad("That line is not in this document");
  return data;
}
async function allLines(db: Db, documentId: string) {
  const { data, error } = await db.from("decisions").select("*").eq("document_id", documentId).order("ord", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateDecisionLine(context: Context, input: UpdateDecisionLineInput) {
  const { event } = await ownedDocument(context, input);
  const old = await lineById(context.supabase, input.document_id, input.id);
  const patch = validatePatch(input.patch);
  const { data, error } = await context.supabase.from("decisions").update(patch).eq("document_id", input.document_id).eq("id", input.id).select("*").single();
  if (error) throw new Error(error.message);
  if (patch.status !== undefined && patch.status !== old.status) await event("decisions_doc.decision_status_changed", { from: words[old.status], to: words[patch.status], via: "ledger" });
  if ((patch.call_text !== undefined && patch.call_text !== old.call_text) || (patch.why !== undefined && patch.why !== old.why)) await event("decisions_doc.line_changed", { action: "edited", via: "ledger" });
  return data;
}

export async function addDecisionLine(context: Context, input: AddDecisionLineInput) {
  const { document, profile, event } = await ownedDocument(context, input);
  const patch = validatePatch(input);
  if (patch.call_text === undefined) bad("call_text is required");
  const lines = await allLines(context.supabase, document.id);
  const { data, error } = await context.supabase.from("decisions").insert({
    document_id: document.id, owner_id: profile.id, ord: Math.max(0, ...lines.map((line) => line.ord ?? 0)) + 1,
    situation: document.title, call_text: patch.call_text, why: patch.why ?? "", status: patch.status ?? "draft", author: "human",
    engagement_id: lines.find((line) => line.engagement_id !== null)?.engagement_id ?? null, srcs: [],
  }).select("*").single();
  if (error) throw new Error(error.message);
  await event("decisions_doc.decision_added", { via: "typed", has_pointer: false });
  return data;
}

export async function removeDecisionLine(context: Context, input: RemoveDecisionLineInput) {
  const { event } = await ownedDocument(context, input);
  await lineById(context.supabase, input.document_id, input.id);
  const { data, error } = await context.supabase.from("decisions").delete().eq("document_id", input.document_id).eq("id", input.id).select("*").single();
  if (error) throw new Error(error.message);
  await event("decisions_doc.line_changed", { action: "removed", via: "ledger" });
  return data;
}

export async function restoreDecisionLine(context: Context, input: RestoreDecisionLineInput) {
  const { profile, event } = await ownedDocument(context, input);
  const row = input.row;
  if (!row || row.document_id !== input.document_id || row.owner_id !== profile.id || typeof row.id !== "string" || !row.id) bad("The restored line must belong to this document and its owner");
  validatePatch(row);
  const existing = await context.supabase.from("decisions").select("*").eq("id", row.id).maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    if (existing.data.document_id !== input.document_id || existing.data.owner_id !== profile.id) bad("That id belongs to another line");
    return existing.data;
  }
  const { data, error } = await context.supabase.from("decisions").insert(row).select("*").single();
  if (error) throw new Error(error.message);
  await event("decisions_doc.line_changed", { action: "restored", via: "ledger" });
  return data;
}

export async function reorderDecisionLines(context: Context, input: ReorderDecisionLinesInput) {
  const { event } = await ownedDocument(context, input);
  const lines = await allLines(context.supabase, input.document_id);
  const ids = input.ids_in_order;
  if (!Array.isArray(ids) || ids.length !== lines.length || new Set(ids).size !== ids.length || ids.some((id) => !lines.some((line) => line.id === id))) bad("ids_in_order must contain exactly this document's current line ids");
  for (const [index, id] of ids.entries()) {
    const { error } = await context.supabase.from("decisions").update({ ord: index + 1 }).eq("document_id", input.document_id).eq("id", id);
    if (error) throw new Error(error.message);
  }
  await event("decisions_doc.line_changed", { action: "reordered", via: "ledger" });
  return allLines(context.supabase, input.document_id);
}

export async function setDecisionPointer(context: Context, input: SetDecisionPointerInput) {
  const { document, event } = await ownedDocument(context, input);
  await lineById(context.supabase, input.document_id, input.id);
  if (input.turn !== null) {
    if (typeof input.turn !== "number" || !Number.isInteger(input.turn) || input.turn < 1) bad("turn must be a positive integer or null");
    if (!document.parent_work_item_id) bad("That turn is not in the chat this document came from");
    const { data, error } = await context.supabase.from("turns").select("id").eq("work_item_id", document.parent_work_item_id).eq("turn_no", input.turn).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) bad("That turn is not in the chat this document came from");
  }
  const { data, error } = await context.supabase.from("decisions").update({ srcs: input.turn === null ? [] : [{ turn: input.turn }] })
    .eq("document_id", input.document_id).eq("id", input.id).select("*").single();
  if (error) throw new Error(error.message);
  await event("decisions_doc.line_changed", { action: input.turn === null ? "pointer_cleared" : "pointer_set", via: "ledger" });
  return data;
}

export async function recordDecisionsVersion(context: Context, input: DecisionDocumentInput) {
  const { document, event } = await ownedDocument(context, input);
  const lines = await allLines(context.supabase, input.document_id);
  const body = renderDecisionsMarkdown(document.title, lines.map((line) => ({ ...line, ord: line.ord ?? 0 })));
  const slug = document.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "document";
  const path = `${context.userId}/decisions-${slug}-${crypto.randomUUID()}.md`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  const hash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const upload = await context.supabase.storage.from("work-files").upload(path, new TextEncoder().encode(body), { contentType: "text/markdown", upsert: false });
  if (upload.error) throw new Error(upload.error.message);
  const meta = document.source_meta && typeof document.source_meta === "object" && !Array.isArray(document.source_meta) ? document.source_meta : {};
  const { error } = await context.supabase.from("work_items").update({ content_ref: path, content_hash: hash,
    source_meta: { ...meta, lines: lines.filter((line) => line.status !== "discarded").length, dropped: lines.filter((line) => line.status === "discarded").length },
  }).eq("id", document.id).eq("owner_id", document.owner_id);
  if (error) throw new Error(error.message);
  // The current origin constraint has no value for human edits; omit it.
  const version_no = await recordNewVersion(context.supabase, { workItemId: document.id, previousRef: document.content_ref, previousHash: document.content_hash,
    previousAt: document.captured_at, newRef: path, newHash: hash, sourceEvent: "ledger_edit" });
  await event("decisions_doc.version_recorded", { changed: "ledger", added: "0", dropped: "0" });
  return { version_no };
}