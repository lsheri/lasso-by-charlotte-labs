/**
 * 19 Nov, Firm Brain Build Spec step 8: the checks and reads behind the reading list, the exemplar mark and the
 * common question kinds. Call only after requireFirmMember (an active member of a company workspace, never a coach
 * or a guest). Rules are in manager-tools-shared.ts.
 *
 * Writes go through the admin client because members hold no write access to either table. Reads of the two tables
 * name their columns: the columns that say who pinned or who marked are never selected, for any reader.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ResolvedProfile } from "@/lib/profile-resolve";

import { readFirmCorpus, requireFirmMember } from "./firm-corpus.server";
import type { FirmCorpus } from "./firm-corpus-shared";
import {
  canMarkExemplar,
  canPinReading,
  canSeeCommonQuestions,
  commonQuestionLines,
  EXEMPLAR_COPY,
  firstFreeSlot,
  pinRefusal,
  READING_LIST_COPY,
  readingListView,
  type BoardInput,
  type CommonQuestion,
  type ExemplarInput,
  type ExemplarWrite,
  type PinInput,
  type ProfileInput,
  type ReadingList,
  type ReadingWrite,
} from "./manager-tools-shared";

type Db = SupabaseClient<Database>;

/** What every call here needs: the admin client and profile from requireFirmMember, and the caller's firm corpus. */
export type ManagerContext = { admin: Db; profile: ResolvedProfile; corpus: FirmCorpus };

const PIN_COLUMNS = "thread_id, slot";

/** The board, only when it is in the caller's workspace. Any other board reads as not found. */
async function boardInWorkspace(admin: Db, profile: ResolvedProfile, boardId: string): Promise<{ id: string; ownerId: string | null }> {
  const { data, error } = await admin.from("engagements").select("id, org_id, owner_id").eq("id", boardId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.org_id !== profile.org_id) throw new Response("Not found", { status: 404 });
  return { id: data.id, ownerId: data.owner_id };
}

async function pinRows(client: Db, orgId: string, boardId: string): Promise<{ thread_id: string; slot: number }[]> {
  const { data, error } = await client.from("board_reading_pins").select(PIN_COLUMNS).eq("org_id", orgId).eq("board_id", boardId);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/**
 * The board's reading list for this reader. People who may pin read through the admin client so they can manage a
 * list on a board they are not on; everyone else reads with their own client, so the database's read rule decides
 * (on the board or its owner, and the engagement still shared). Either way the list is then cut to engagements the
 * firm reader serves this reader.
 */
export async function readingList(ctx: ManagerContext & { supabase: Db }, boardId: string): Promise<ReadingList> {
  const board = await boardInWorkspace(ctx.admin, ctx.profile, boardId);
  const canPin = canPinReading(ctx.profile.role, board.ownerId === ctx.profile.id);
  const rows = await pinRows(canPin ? ctx.admin : ctx.supabase, ctx.profile.org_id, boardId);
  return readingListView(rows, ctx.corpus, boardId, canPin);
}

/** Pins a shared engagement to a board, in the first free slot. A rule that says no comes back as a plain line. */
export async function pinReadingThread(ctx: ManagerContext, input: { boardId: string; threadId: string }): Promise<ReadingWrite> {
  const { admin, profile, corpus } = ctx;
  const board = await boardInWorkspace(admin, profile, input.boardId);
  if (!canPinReading(profile.role, board.ownerId === profile.id)) throw new Response("Forbidden", { status: 403 });
  if (input.threadId === input.boardId) return { ok: false, refusal: READING_LIST_COPY.refusedSelf };
  // One line for every engagement the firm reader does not serve: unshared, archived, another workspace, or not there.
  const shared = new Set(corpus.boards.map((entry) => entry.id));
  if (!shared.has(input.threadId)) return { ok: false, refusal: READING_LIST_COPY.refusedNotShared };

  const rows = await pinRows(admin, profile.org_id, input.boardId);
  if (rows.some((row) => row.thread_id === input.threadId)) return { ok: false, refusal: READING_LIST_COPY.refusedAlready };
  let slot = firstFreeSlot(rows.map((row) => row.slot));
  if (slot === null) {
    // A pin whose engagement is no longer shared still holds its slot. Nobody can see it, so it gives way to a new pin.
    const hidden = rows.filter((row) => !shared.has(row.thread_id)).sort((a, b) => a.slot - b.slot)[0];
    if (!hidden) return { ok: false, refusal: READING_LIST_COPY.refusedFull };
    const { error: cleared } = await admin.from("board_reading_pins").delete().eq("org_id", profile.org_id).eq("board_id", input.boardId).eq("thread_id", hidden.thread_id);
    if (cleared) return { ok: false, refusal: READING_LIST_COPY.failed };
    slot = firstFreeSlot(rows.filter((row) => row !== hidden).map((row) => row.slot));
    if (slot === null) return { ok: false, refusal: READING_LIST_COPY.refusedFull };
  }

  const { error } = await admin
    .from("board_reading_pins")
    .insert({ org_id: profile.org_id, board_id: input.boardId, thread_id: input.threadId, slot, pinned_by: profile.id });
  if (error) return { ok: false, refusal: pinRefusal(error) };
  return { ok: true, list: readingListView(await pinRows(admin, profile.org_id, input.boardId), corpus, input.boardId, true) };
}

/** Removes a pin. Removing one that is not there is not an error. */
export async function unpinReadingThread(ctx: ManagerContext, input: { boardId: string; threadId: string }): Promise<ReadingWrite> {
  const { admin, profile, corpus } = ctx;
  const board = await boardInWorkspace(admin, profile, input.boardId);
  if (!canPinReading(profile.role, board.ownerId === profile.id)) throw new Response("Forbidden", { status: 403 });
  const { error } = await admin.from("board_reading_pins").delete().eq("org_id", profile.org_id).eq("board_id", input.boardId).eq("thread_id", input.threadId);
  if (error) return { ok: false, refusal: READING_LIST_COPY.failed };
  return { ok: true, list: readingListView(await pinRows(admin, profile.org_id, input.boardId), corpus, input.boardId, true) };
}

/** The corpus item to mark, or null when the firm reader does not serve it to this caller on that board. */
function exemplarTarget(corpus: FirmCorpus, input: { itemId: string; engagementId?: string | null | undefined }) {
  const item = corpus.items.find((entry) => entry.id === input.itemId);
  if (!item || (input.engagementId && input.engagementId !== item.boardId)) return null;
  return item;
}

/**
 * Marks an item as an exemplar, on the shared board the firm reader places it on. Admins and leads only. Marking
 * twice changes nothing.
 */
export async function markExemplar(ctx: ManagerContext, input: { itemId: string; engagementId?: string | null | undefined }): Promise<ExemplarWrite> {
  const { admin, profile, corpus } = ctx;
  if (!canMarkExemplar(profile.role)) throw new Response("Forbidden", { status: 403 });
  const item = exemplarTarget(corpus, input);
  if (!item) return { ok: false, refusal: EXEMPLAR_COPY.refusedNotShared };
  const { error } = await admin
    .from("firm_exemplars")
    .upsert(
      { org_id: profile.org_id, engagement_id: item.boardId, work_item_id: item.id, marked_by: profile.id },
      { onConflict: "engagement_id,work_item_id", ignoreDuplicates: true },
    );
  if (error) return { ok: false, refusal: /shared with the firm|not on this board/i.test(error.message ?? "") ? EXEMPLAR_COPY.refusedNotShared : EXEMPLAR_COPY.failed };
  return { ok: true, exemplar: true };
}

/** Removes the mark. Admins and leads only. */
export async function unmarkExemplar(ctx: ManagerContext, input: { itemId: string; engagementId?: string | null | undefined }): Promise<ExemplarWrite> {
  const { admin, profile, corpus } = ctx;
  if (!canMarkExemplar(profile.role)) throw new Response("Forbidden", { status: 403 });
  const item = exemplarTarget(corpus, input);
  if (!item) return { ok: false, refusal: EXEMPLAR_COPY.refusedNotShared };
  const { error } = await admin.from("firm_exemplars").delete().eq("org_id", profile.org_id).eq("engagement_id", item.boardId).eq("work_item_id", item.id);
  if (error) return { ok: false, refusal: EXEMPLAR_COPY.failed };
  return { ok: true, exemplar: false };
}

/**
 * The kinds of question people ask the firm, for admins and leads. Called with the caller's own client: the database
 * function identifies the caller itself, returns a kind only once five people have asked it, and returns a band,
 * never a count. The admin client would get nothing. Only fixed labels and bands leave this function.
 */
export async function commonQuestionKinds(ctx: { supabase: Db; profile: ResolvedProfile }): Promise<CommonQuestion[]> {
  if (!canSeeCommonQuestions(ctx.profile.role)) throw new Response("Forbidden", { status: 403 });
  const { data, error } = await ctx.supabase.rpc("firm_common_question_kinds", { p_org: ctx.profile.org_id });
  if (error) throw new Error("Could not read the common question kinds.");
  return commonQuestionLines(data);
}

/* ---------- the calls the server functions make ---------- */

/** A signed-in caller, as the auth middleware hands it over. */
export type CallContext = { supabase: Db; userId: string };

/**
 * The one gate for every manager tool: an active member of a company workspace who is neither a coach nor a guest,
 * then that person's own firm corpus. No flag sits in front of the screens; this is the real check.
 */
async function gate(context: CallContext, profileId: string | null | undefined): Promise<ManagerContext & { supabase: Db }> {
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  return { admin: supabaseAdmin, profile, corpus: await readFirmCorpus(supabaseAdmin, profile), supabase: context.supabase };
}

export async function readingListCall(context: CallContext, data: BoardInput): Promise<ReadingList> {
  return readingList(await gate(context, data.profile_id), data.board_id);
}

export async function pinReadingThreadCall(context: CallContext, data: PinInput): Promise<ReadingWrite> {
  return pinReadingThread(await gate(context, data.profile_id), { boardId: data.board_id, threadId: data.thread_id });
}

export async function unpinReadingThreadCall(context: CallContext, data: PinInput): Promise<ReadingWrite> {
  return unpinReadingThread(await gate(context, data.profile_id), { boardId: data.board_id, threadId: data.thread_id });
}

export async function markExemplarCall(context: CallContext, data: ExemplarInput): Promise<ExemplarWrite> {
  return markExemplar(await gate(context, data.profile_id), { itemId: data.item_id, engagementId: data.engagement_id });
}

export async function unmarkExemplarCall(context: CallContext, data: ExemplarInput): Promise<ExemplarWrite> {
  return unmarkExemplar(await gate(context, data.profile_id), { itemId: data.item_id, engagementId: data.engagement_id });
}

/** No corpus read here: the database function does the counting, for the caller's own workspace only. */
export async function commonQuestionKindsCall(context: CallContext, data: ProfileInput): Promise<CommonQuestion[]> {
  const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
  return commonQuestionKinds({ supabase: context.supabase, profile });
}
