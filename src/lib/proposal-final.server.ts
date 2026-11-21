/**
 * 21 Nov 2026, chat pill PR 4c (D-97): the Lead decides the final proposal, server side. Rules first with their outside
 * world as `FinalStore` (the Lead's store plus a few reads and writes), so each is tested without a database.
 *
 * Who chooses: the teammate linked to the proposal's lead, or the person who started it, on an open proposal in their
 * workspace (requireFirmMember first). What counts: the chooser's own work item (an upload or a draft), or one of the
 * proposal's own documents they may open (the owner always; the lead once the owner sent them). The choice is a new
 * row; the latest counts. A draft is made from the brief and the documents the chooser may open, with no board, by
 * the draft engine (it never reads a fee or another client's name, and removes figures), and saved as the chooser's
 * own unplaced work. It is not chosen until they choose it.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { docsSentToLead } from "./lead-view-shared";
import { leads, realLeadStore, type LeadCaller, type LeadContext, type LeadProposalRow, type LeadStore } from "./lead-view.server";
import { countBand } from "./proposal-desk-shared";
import {
  draftTitle,
  FINAL_COPY,
  type ChooseFinalInput,
  type ChooseFinalResult,
  type DraftFinalInput,
  type DraftFinalResult,
} from "./proposal-final-shared";

type Db = SupabaseClient<Database>;

export type MadeDraft = { itemId: string; title: string; gaps: number; questions: number };

export type FinalStore = LeadStore & {
  /** One work item in this workspace: its owner and title. Null when it is not there. */
  item: (orgId: string, itemId: string) => Promise<{ id: string; owner_id: string; title: string } | null>;
  /** The newest saved version of a work item, when it has versions. */
  latestVersion: (itemId: string) => Promise<string | null>;
  insertFinal: (row: { org_id: string; proposal_id: string; work_item_id: string; document_version_id: string | null; chosen_by: string; chosen_at: string }) => Promise<boolean | "absent">;
  /** Runs the draft engine on these notes and documents and saves the draft as the caller's own unplaced work. */
  makeDraft: (caller: LeadCaller, input: { title: string; intake: string; documents: { id: string; title: string; text: string }[] }) => Promise<MadeDraft | null>;
  recordDraft: (caller: LeadCaller, dims: Record<string, string>) => Promise<void>;
};

/** The chooser may act on this proposal: its linked lead, or the person who started it. */
async function mayDecide(store: FinalStore, caller: LeadCaller, row: LeadProposalRow | null): Promise<boolean> {
  if (!row || row.org_id !== caller.orgId || row.status !== "open" || row.archived_at) return false;
  return row.owner_id === caller.profileId || (await leads(store, caller, row));
}

/** The proposal's own documents this caller may open: the owner always, the lead once they were sent. */
async function openableDocuments(store: FinalStore, caller: LeadCaller, row: LeadProposalRow): Promise<{ id: string; title: string }[]> {
  const owner = row.owner_id === caller.profileId;
  let sentIds: string[] | null = null;
  if (!owner) {
    const read = await store.sentDocs(caller.orgId, [row.id]).catch(() => "absent" as const);
    const record = read === "absent" ? undefined : read.get(row.id);
    if (!docsSentToLead(row, record)) return [];
    sentIds = record!.item_ids;
  }
  // The lead opens only what was sent (QA M1 of PR 299); the owner, all of their own.
  const listed = (await store.context([row.id]))
    .filter((entry) => entry.proposal_id === row.id && (sentIds === null || sentIds.includes(entry.work_item_id)))
    .map((entry) => entry.work_item_id);
  if (!listed.length) return [];
  const owned = await store.ownedItems(caller.orgId, row.owner_id, listed);
  return listed.map((itemId) => owned.find((item) => item.id === itemId)).filter((item): item is { id: string; title: string } => Boolean(item));
}

export async function chooseFinal(store: FinalStore, input: ChooseFinalInput): Promise<ChooseFinalResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: FINAL_COPY.notLead };
  if (row.status !== "open" || row.archived_at) return { ok: false, problem: FINAL_COPY.closed };
  if (!(await mayDecide(store, caller, row))) return { ok: false, problem: FINAL_COPY.notLead };
  const item = await store.item(caller.orgId, input.work_item_id);
  if (!item) return { ok: false, problem: FINAL_COPY.notYours };
  const own = item.owner_id === caller.profileId;
  const listed = !own && (await openableDocuments(store, caller, row)).some((doc) => doc.id === item.id);
  if (!own && !listed) return { ok: false, problem: FINAL_COPY.notYours };
  const at = store.now().toISOString();
  const version = await store.latestVersion(item.id).catch(() => null);
  const written = await store.insertFinal({ org_id: caller.orgId, proposal_id: row.id, work_item_id: item.id, document_version_id: version, chosen_by: caller.profileId, chosen_at: at });
  if (written === "absent") return { ok: false, problem: FINAL_COPY.notReady };
  if (!written) return { ok: false, problem: FINAL_COPY.failed };
  // Where it came from is what the person said, checked: a document that is not theirs is always "document".
  const source = own ? (input.source === "document" ? "upload" : input.source) : "document";
  try {
    await store.record(caller, "proposal.final_chosen", { source });
  } catch {
    /* chosen; a recording fault never undoes it */
  }
  return { ok: true, final: { itemId: item.id, title: item.title, chosenAt: at } };
}

export async function draftFinal(store: FinalStore, input: DraftFinalInput): Promise<DraftFinalResult> {
  const caller = await store.caller();
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: FINAL_COPY.notLead };
  if (row.status !== "open" || row.archived_at) return { ok: false, problem: FINAL_COPY.closed };
  if (!(await mayDecide(store, caller, row))) return { ok: false, problem: FINAL_COPY.notLead };
  const docs = await openableDocuments(store, caller, row);
  const documents: { id: string; title: string; text: string }[] = [];
  for (const doc of docs) {
    const text = await store.itemText(caller.orgId, doc.id).catch(() => null);
    if (text?.trim()) documents.push({ id: doc.id, title: doc.title, text });
  }
  const notes = row.notes?.trim() ?? "";
  // Nothing to draft from: refused before any model call.
  if (!notes && documents.length === 0) return { ok: false, problem: FINAL_COPY.noBrief };
  let made: MadeDraft | null;
  try {
    made = await store.makeDraft(caller, { title: draftTitle(row.title), intake: notes, documents });
  } catch (failure) {
    // The daily spend limit says so in its own words.
    if (failure instanceof Response && failure.status === 429) return { ok: false, problem: await failure.text().catch(() => FINAL_COPY.draftFailed) };
    return { ok: false, problem: FINAL_COPY.draftFailed };
  }
  if (!made) return { ok: false, problem: FINAL_COPY.draftFailed };
  try {
    await store.recordDraft(caller, { gaps: countBand(made.gaps), questions: countBand(made.questions) });
  } catch {
    /* saved; a recording fault changes nothing */
  }
  return { ok: true, ...made };
}

/* ---------------------------------------------------------------------------
 * The real outside world.
 * ------------------------------------------------------------------------- */

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function realFinalStore(context: LeadContext, profileId: string | null): Promise<FinalStore> {
  const base = await realLeadStore(context, profileId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const own = context.supabase;
  return {
    ...base,
    async item(orgId, itemId) {
      const { data } = await admin.from("work_items").select("id, owner_id, title, display_title").eq("org_id", orgId).eq("id", itemId).maybeSingle();
      const row = data as { id: string; owner_id: string; title: string; display_title: string | null } | null;
      return row ? { id: row.id, owner_id: row.owner_id, title: row.display_title || row.title } : null;
    },
    async latestVersion(itemId) {
      const { data } = await admin.from("document_versions").select("id").eq("work_item_id", itemId).order("version_no", { ascending: false }).limit(1).maybeSingle();
      return (data as { id: string } | null)?.id ?? null;
    },
    async insertFinal(row) {
      const { error } = await admin.from("proposal_final_versions").insert(row);
      if (error) return ["42P01", "PGRST205"].includes(error.code ?? "") ? "absent" : false;
      return true;
    },
    async makeDraft(caller, input) {
      const { requireFirmMember, readFirmCorpus, readFirmItemText } = await import("./firm-corpus.server");
      const { profile } = await requireFirmMember(own as never, context.userId, profileId);
      const corpus = await readFirmCorpus(supabaseAdmin as never, profile);
      const { cleanBrief } = await import("./proposal-shared");
      const { chatComplete, resolveAiMeta } = await import("./ai.server");
      const meta = await resolveAiMeta(own as never, { surface: "proposal_draft", orgId: caller.orgId, profileId: caller.profileId, userId: caller.userId });
      const { runProposalDraft } = await import("./proposal-draft.server");
      const intake = [input.intake, ...input.documents.map((doc) => `${doc.title}\n${doc.text}`)].filter(Boolean).join("\n\n");
      const { draft } = await runProposalDraft(chatComplete, {
        corpus,
        precedentIds: [],
        intake,
        brief: cleanBrief({}),
        ownItems: new Map(input.documents.map((doc) => [doc.id, { title: doc.title, text: doc.text }])),
        read: (itemId) => readFirmItemText(supabaseAdmin as never, corpus, itemId),
        meta,
      });
      const { renderProposalMarkdown, isEmptyDraft } = await import("./proposal-draft-shared");
      if (isEmptyDraft(draft)) return null;
      const body = renderProposalMarkdown(input.title, draft);
      const path = `${caller.userId}/proposal-final-${crypto.randomUUID()}.md`;
      const hash = await sha256(body);
      const upload = await own.storage.from("work-files").upload(path, new TextEncoder().encode(body), { contentType: "text/markdown", upsert: false });
      if (upload.error) return null;
      let itemId: string | null = null;
      try {
        // The caller's own unplaced work, as the person, so the app's own rules for their items apply.
        const { data: item, error } = await own
          .from("work_items")
          .insert({
            owner_id: caller.profileId,
            org_id: caller.orgId,
            type: "document",
            source: "manual",
            title: input.title,
            visibility: "unmapped",
            content_ref: path,
            content_hash: hash,
            content_fidelity: "verbatim",
            ts_precision: "capture",
            source_meta: { filename: "proposal-draft.md", mime_type: "text/markdown" },
            meta: { mime_type: "text/markdown", deliverable_kind: "proposal", proposal_draft: draft as never },
          })
          .select("id")
          .single();
        if (error || !item) throw new Error("draft item");
        itemId = item.id;
        const version = await admin.from("document_versions").insert({ work_item_id: item.id, version_no: 1, content_ref: path, content_hash: hash, parent_version_id: null, source_event: "proposal_draft", origin: "model_artifact" });
        if (version.error) throw new Error("draft version");
      } catch {
        if (itemId) await own.from("work_items").delete().eq("id", itemId).eq("owner_id", caller.profileId);
        await own.storage.from("work-files").remove([path]).catch(() => {});
        return null;
      }
      return {
        itemId,
        title: input.title,
        gaps: draft.sections.filter((section) => section.status === "gap").length,
        questions: draft.questions.length,
      };
    },
    async recordDraft(who, dims) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin as never, { eventType: "proposal.final_drafted", orgId: who.orgId, userId: who.userId, profileId: who.profileId, dims });
    },
  };
}

export const finalHandlers = {
  async choose(context: LeadContext, data: ChooseFinalInput): Promise<ChooseFinalResult> {
    return chooseFinal(await realFinalStore(context, data.profile_id), data);
  },
  async draft(context: LeadContext, data: DraftFinalInput): Promise<DraftFinalResult> {
    return draftFinal(await realFinalStore(context, data.profile_id), data);
  },
};

export type { Db as FinalDb };
