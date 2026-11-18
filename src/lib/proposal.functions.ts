import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ProposalDraft } from "@/lib/proposal-draft-shared";
import type { GoodProposal, PastFee, Precedent, ProposalBrief } from "@/lib/proposal-shared";

type BoardInput = { engagement_id: string; profile_id?: string | null | undefined };
type FindInput = BoardInput & { brief: unknown };

const UUID = /^[0-9a-f-]{36}$/i;

function validateBoard(input: BoardInput): BoardInput {
  const id = typeof input?.engagement_id === "string" ? input.engagement_id.trim() : "";
  if (!UUID.test(id)) throw new Error("Unknown board.");
  return { engagement_id: id, profile_id: input?.profile_id ?? null };
}

/**
 * 17 Nov, Start a proposal step 1: the six-line brief, read from this board's notes with the person's own access.
 * Any member of a company workspace may start one on a board they can open, except coaches and guests.
 */
export const draftProposalBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBoard)
  .handler(async ({ data, context }): Promise<ProposalBrief> => {
    const { requireFirmMember } = await import("./firm-corpus.server");
    const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const { getItemText, ITEM_TEXT_COLUMNS } = await import("./item-text.server");
    const { readPursuitNotes, draftBrief } = await import("./proposal-precedents.server");
    const caller = context.supabase;
    const notes = await readPursuitNotes(caller, data.engagement_id, async (itemId) => {
      const { data: row } = await caller.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", itemId).maybeSingle();
      if (!row) return null;
      return (await getItemText(caller, row as never)).text ?? null;
    });
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(caller as never, { surface: "proposal_brief", orgId: profile.org_id, profileId: profile.id, userId: context.userId });
    const brief = await draftBrief(chatComplete, notes, meta);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(caller, { eventType: "proposal_draft.started", orgId: profile.org_id, userId: context.userId, dims: { input_kind: "board_notes" } });
    return brief;
  });

export type PrecedentsResult = {
  precedents: Precedent[];
  /** Every other shared engagement, to swap a precedent for. */
  options: Precedent[];
  good: GoodProposal[];
  /** Admins and leads only; empty lists for everyone else. Covers every option, so a swap needs no new request. */
  fees: { fixed: PastFee[]; monthly: PastFee[] };
  canSeeFees: boolean;
  coverage: string;
};

/**
 * 17 Nov, Start a proposal step 1: up to three precedents from work shared with the firm, the firm's client-shown
 * proposals, and past fees for admins and leads. The new board itself never counts as its own precedent.
 */
export const findProposalPrecedents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FindInput) => ({ ...validateBoard(input), brief: input?.brief }))
  .handler(async ({ data, context }): Promise<PrecedentsResult> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const full = await readFirmCorpus(supabaseAdmin, profile);
    const corpus = {
      ...full,
      boards: full.boards.filter((board) => board.id !== data.engagement_id),
      items: full.items.filter((item) => item.boardId !== data.engagement_id),
    };
    const { cleanBrief, precedentView, goodProposals, pastFees } = await import("./proposal-shared");
    const { coverageLine } = await import("./firm-corpus-shared");
    const { pickPrecedents } = await import("./proposal-precedents.server");
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(context.supabase as never, { surface: "proposal_precedents", orgId: profile.org_id, profileId: profile.id, userId: context.userId });

    const picks = await pickPrecedents(chatComplete, corpus, cleanBrief(data.brief), meta);
    const precedents = picks.map((pick) => precedentView(corpus, pick)).filter((view): view is Precedent => view !== null);
    const chosen = new Set(precedents.map((view) => view.boardId));
    const options = corpus.boards
      .filter((board) => !chosen.has(board.id))
      .map((board) => precedentView(corpus, { boardId: board.id, closeness: "loose", why: "" }))
      .filter((view): view is Precedent => view !== null);
    const canSeeFees = profile.role === "admin" || profile.role === "lead";

    const { recordEvent } = await import("./telemetry.server");
    const { bucket } = await import("./telemetry-shared");
    await recordEvent(context.supabase, {
      eventType: "proposal_draft.precedents_shown",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { close: bucket(precedents.filter((view) => view.closeness === "close").length), loose: bucket(precedents.filter((view) => view.closeness === "loose").length) },
    });
    return {
      precedents,
      options,
      good: goodProposals(corpus),
      fees: pastFees(corpus, corpus.boards.map((board) => board.id), canSeeFees),
      canSeeFees,
      coverage: coverageLine(corpus),
    };
  });

type DraftInput = BoardInput & { brief: unknown; precedent_ids: unknown };
type SectionInput = { item_id: string; section: string; profile_id?: string | null | undefined };

export type ProposalDraftResult = { itemId: string; title: string; draft: ProposalDraft };

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Firm members who can edit this board; never coaches or guests. */
async function draftGate(context: { supabase: Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0]; userId: string }, engagementId: string, profileId: string | null | undefined) {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const member = await requireFirmMember(context.supabase, context.userId, profileId);
  const { isEngagementEditor } = await import("./canvas-lab.server");
  if (!(await isEngagementEditor(context.supabase, engagementId, member.profile.id))) throw new Response("Forbidden", { status: 403 });
  return member;
}

/**
 * 17 Nov, Start a proposal step 2: the first draft, as sections, saved as a document card the person owns. The new
 * board's notes are read with the person's own access; precedents only through the firm reader. The panel then puts
 * the card on the board. Nothing is sent to anyone.
 */
export const draftProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: DraftInput) => ({
    ...validateBoard(input),
    brief: input?.brief,
    precedent_ids: (Array.isArray(input?.precedent_ids) ? input.precedent_ids : []).filter((id): id is string => typeof id === "string" && UUID.test(id)).slice(0, 3),
  }))
  .handler(async ({ data, context }): Promise<ProposalDraftResult> => {
    const caller = context.supabase;
    const { profile, supabaseAdmin } = await draftGate(context, data.engagement_id, data.profile_id);
    const { readFirmCorpus, readFirmItemText } = await import("./firm-corpus.server");
    const full = await readFirmCorpus(supabaseAdmin, profile);
    const corpus = { ...full, boards: full.boards.filter((board) => board.id !== data.engagement_id), items: full.items.filter((item) => item.boardId !== data.engagement_id) };
    const known = new Set(corpus.boards.map((board) => board.id));
    const precedentIds = data.precedent_ids.filter((id) => known.has(id));

    const { getItemText, ITEM_TEXT_COLUMNS } = await import("./item-text.server");
    const { readPursuitSources } = await import("./proposal-precedents.server");
    const pursuit = await readPursuitSources(caller, data.engagement_id, async (itemId) => {
      const { data: row } = await caller.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", itemId).maybeSingle();
      if (!row) return null;
      return (await getItemText(caller, row as never)).text ?? null;
    });

    const { cleanBrief } = await import("./proposal-shared");
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(caller as never, { surface: "proposal_draft", orgId: profile.org_id, profileId: profile.id, userId: context.userId });
    const { runProposalDraft } = await import("./proposal-draft.server");
    const { draft } = await runProposalDraft(chatComplete, {
      corpus,
      precedentIds,
      intake: pursuit.notes,
      brief: cleanBrief(data.brief),
      ownItems: new Map(pursuit.items.map((item) => [item.id, { title: item.title, text: item.text }])),
      read: (itemId) => readFirmItemText(supabaseAdmin, corpus, itemId),
      meta,
    });

    const { renderProposalMarkdown } = await import("./proposal-draft-shared");
    const title = `Proposal draft: ${pursuit.title}`.slice(0, 200);
    const body = renderProposalMarkdown(title, draft);
    const slug = pursuit.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proposal";
    const path = `${context.userId}/proposal-${slug}-${crypto.randomUUID()}.md`;
    const hash = await sha256(body);
    const upload = await caller.storage.from("work-files").upload(path, new TextEncoder().encode(body), { contentType: "text/markdown", upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const { data: item, error } = await caller
      .from("work_items")
      .insert({
        owner_id: profile.id,
        org_id: profile.org_id,
        type: "document",
        source: "manual",
        title,
        visibility: "unmapped",
        content_ref: path,
        content_hash: hash,
        content_fidelity: "verbatim",
        ts_precision: "capture",
        source_meta: { filename: `proposal-${slug}.md`, mime_type: "text/markdown" },
        meta: { mime_type: "text/markdown", deliverable_kind: "proposal", proposal_draft: draft as never },
      })
      .select("id")
      .single();
    if (error || !item) throw new Error(error?.message ?? "Could not save the draft.");
    const version = await supabaseAdmin.from("document_versions").insert({ work_item_id: item.id, version_no: 1, content_ref: path, content_hash: hash, parent_version_id: null, source_event: "proposal_draft", origin: "model_artifact" });
    if (version.error) throw new Error(version.error.message);

    const { recordEvent } = await import("./telemetry.server");
    const { bucket } = await import("./telemetry-shared");
    await recordEvent(caller, {
      eventType: "proposal_draft.created",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { sections: bucket(draft.sections.length), gaps: bucket(draft.sections.filter((section) => section.status === "gap").length), questions: bucket(draft.questions.length) },
    });
    return { itemId: item.id, title, draft };
  });

/** The person's own proposal draft item, with its stored draft. */
async function ownDraft(context: { supabase: Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0]; userId: string }, itemId: string, profileId: string | null | undefined) {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const member = await requireFirmMember(context.supabase, context.userId, profileId);
  const { data: item, error } = await context.supabase.from("work_items").select("id, title, owner_id, meta, content_ref, content_hash, captured_at").eq("id", itemId).maybeSingle();
  if (error) throw new Error(error.message);
  const { storedDraft } = await import("./proposal-draft-shared");
  const draft = item ? storedDraft(item.meta) : null;
  if (!item || !draft || item.owner_id !== member.profile.id) throw new Response("Forbidden", { status: 403 });
  return { ...member, item, draft };
}

/** 17 Nov, Start a proposal step 2: the owner confirms one section. The card's text and meta are rewritten. */
export const confirmProposalSection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SectionInput) => {
    const itemId = typeof input?.item_id === "string" ? input.item_id.trim() : "";
    if (!UUID.test(itemId) || typeof input?.section !== "string") throw new Error("Unknown section.");
    return { item_id: itemId, section: input.section, profile_id: input?.profile_id ?? null };
  })
  .handler(async ({ data, context }): Promise<ProposalDraft> => {
    const { profile, item, draft } = await ownDraft(context, data.item_id, data.profile_id);
    const target = draft.sections.find((section) => section.key === data.section);
    if (!target) throw new Response("Unknown section", { status: 400 });
    if (target.status === "confirmed") return draft;
    const next: ProposalDraft = { ...draft, sections: draft.sections.map((section) => (section.key === data.section ? { ...section, status: "confirmed" } : section)) };
    const { renderProposalMarkdown } = await import("./proposal-draft-shared");
    const body = renderProposalMarkdown(item.title, next);
    const path = `${context.userId}/proposal-${crypto.randomUUID()}.md`;
    const hash = await sha256(body);
    const upload = await context.supabase.storage.from("work-files").upload(path, new TextEncoder().encode(body), { contentType: "text/markdown", upsert: false });
    if (upload.error) throw new Error(upload.error.message);
    const meta = item.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? item.meta : {};
    const { error } = await context.supabase.from("work_items").update({ content_ref: path, content_hash: hash, meta: { ...meta, proposal_draft: next as never } }).eq("id", item.id).eq("owner_id", profile.id);
    if (error) throw new Error(error.message);
    const { recordNewVersion } = await import("./connector-import.server");
    // A person's own edit: the origin constraint has no value for it, so it is omitted.
    await recordNewVersion(context.supabase, { workItemId: item.id, previousRef: item.content_ref, previousHash: item.content_hash, previousAt: item.captured_at, newRef: path, newHash: hash, sourceEvent: "proposal_confirm" });

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, { eventType: "proposal_draft.section_confirmed", orgId: profile.org_id, userId: context.userId, dims: {} });
    return next;
  });

/**
 * 17 Nov, Start a proposal step 2: the person's latest draft on this board, or null. Each quoted source is re-checked
 * against what the firm reader shows them now; a board no longer shared keeps its text but loses its quote.
 */
export const latestProposalDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBoard)
  .handler(async ({ data, context }): Promise<ProposalDraftResult | null> => {
    const caller = context.supabase;
    const { profile, supabaseAdmin } = await draftGate(context, data.engagement_id, data.profile_id);
    const { data: placed } = await caller
      .from("work_item_tasks")
      .select("work_item_id, tasks!inner(engagement_id), work_items!inner(id, title, owner_id, meta, created_at)")
      .eq("tasks.engagement_id", data.engagement_id)
      .eq("work_items.owner_id", profile.id)
      .eq("work_items.meta->>deliverable_kind", "proposal");
    const { storedDraft, recheckSources } = await import("./proposal-draft-shared");
    const rows = ((placed ?? []) as unknown as { work_items: { id: string; title: string; meta: unknown; created_at: string } }[])
      .map((row) => row.work_items)
      .filter((row) => storedDraft(row.meta))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const latest = rows[0];
    if (!latest) return null;
    const { readFirmCorpus } = await import("./firm-corpus.server");
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const { data: own } = await caller.from("work_item_tasks").select("work_item_id, tasks!inner(engagement_id)").eq("tasks.engagement_id", data.engagement_id);
    const visible = new Set([...corpus.items.filter((item) => item.grade === "full").map((item) => item.id), ...((own ?? []) as { work_item_id: string }[]).map((row) => row.work_item_id)]);
    return { itemId: latest.id, title: latest.title, draft: recheckSources(storedDraft(latest.meta)!, visible) };
  });
