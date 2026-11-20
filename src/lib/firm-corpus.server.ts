/**
 * The firm reader: the one way Ask the firm and proposal precedents read work across boards. Neither feature writes
 * its own filter. Rules are in firm-corpus-shared.ts; this file holds the gate and the reads.
 *
 * Sharing a board with the firm grants members no database access to it, so the reads use the admin client behind
 * requireFirmMember, as the firm view does (Liam, 17 Nov: a server gate now, database policies after the buyer
 * sessions). Nothing is stored: every call reads live rows, so a board with sharing turned off is gone at the next
 * question.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { getItemText, ITEM_TEXT_COLUMNS, type TextItem } from "@/lib/item-text.server";
import { resolveProfile, type ResolvedProfile } from "@/lib/profile-resolve";
import { hasFirmView } from "@/lib/workspace-capabilities";

import { methodsOf, roleOf, situationOf, stageOf } from "./engagement-tags";
import { firmGrade, firmMemoryOf, type FirmBoard, type FirmCorpus, type FirmItem } from "./firm-corpus-shared";
import { draftGistOf, isProposalDraft } from "./proposal-draft-shared";

type Db = SupabaseClient<Database>;

/** The only tables the reader opens. Coaching tables, turns of private chats and guests' rows are not on this list. */
export const FIRM_CORPUS_TABLES = [
  "engagements",
  "engagement_members",
  "work_item_tasks",
  "work_items",
  "work_item_extracts",
  "client_showings",
  "firm_exemplars",
  "profiles",
] as const;

/** Page size for id lists, so a request URL stays short. */
const ID_PAGE = 100;

/**
 * Anyone active in a company workspace may ask the firm, except coaches and guests. No flag sits in
 * front of the surface; this is the gate.
 */
export async function requireFirmMember(
  supabase: Db,
  userId: string,
  profileId?: string | null,
): Promise<{ profile: ResolvedProfile; supabaseAdmin: Db }> {
  const profile = await resolveProfile(supabase, userId, profileId);
  if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Db;
  // PERF-4: the two checks are independent, so they are read together; each still refuses on its own.
  const [{ data: me }, { data: org }] = await Promise.all([
    admin.from("profiles").select("is_guest, deactivated_at").eq("id", profile.id).maybeSingle(),
    admin.from("orgs").select("settings").eq("id", profile.org_id).maybeSingle(),
  ]);
  if (!me || me.is_guest || me.deactivated_at) throw new Response("Forbidden", { status: 403 });
  const settings = (org?.settings ?? null) as Record<string, unknown> | null;
  if (!hasFirmView(settings?.["type"] as string | null | undefined)) throw new Response("Forbidden", { status: 403 });
  return { profile, supabaseAdmin: admin };
}

/** The raw rows the assembler needs, as the reads return them. */
export type FirmRows = {
  boards: {
    id: string;
    title: string;
    brief: string | null;
    owner_id: string | null;
    outcome: string | null;
    created_at: string;
    clients: { name: string; quick_folder: boolean } | null;
  }[];
  placements: { work_item_id: string; engagement_id: string }[];
  items: {
    id: string;
    owner_id: string;
    type: string;
    title: string;
    display_title: string | null;
    visibility: string;
    work_date: string | null;
    meta: unknown;
  }[];
  extracts: { work_item_id: string; summary: string | null; decisions: string | null; entities: string | null; created_at: string }[];
  showings: { work_item_id: string; engagement_id: string; shown_on: string; occasion: string | null }[];
  /** Exemplar marks: the item and the board it was marked on, nothing else. Optional so older fixtures stay valid. */
  exemplars?: { work_item_id: string; engagement_id: string }[];
  people: { id: string; display_name: string | null; is_guest: boolean }[];
  /** Boards the asker is on, as a member or the owner. */
  askerBoards: string[];
};

/**
 * Applies the rules, in order: shared boards only (the reads already ask for those), placed on a shared board,
 * not private, not by a guest, and not Out. Pure, so every rule is tested without a database.
 */
export function assembleFirmCorpus(orgId: string, rows: FirmRows): FirmCorpus {
  const boardIds = new Set(rows.boards.map((board) => board.id));
  const askerOn = new Set(rows.askerBoards);
  const person = new Map(rows.people.map((row) => [row.id, row]));
  const placedOn = new Map<string, string>();
  for (const placement of rows.placements) {
    if (boardIds.has(placement.engagement_id) && !placedOn.has(placement.work_item_id)) placedOn.set(placement.work_item_id, placement.engagement_id);
  }
  const latest = new Map<string, FirmRows["extracts"][number]>();
  for (const extract of rows.extracts) {
    const seen = latest.get(extract.work_item_id);
    if (!seen || extract.created_at > seen.created_at) latest.set(extract.work_item_id, extract);
  }

  // A mark counts only on the board it was made on, and only while that board is in this read.
  const marked = new Set((rows.exemplars ?? []).filter((mark) => boardIds.has(mark.engagement_id)).map((mark) => `${mark.engagement_id}:${mark.work_item_id}`));

  const items: FirmItem[] = [];
  for (const item of rows.items) {
    const boardId = placedOn.get(item.id);
    if (!boardId || item.visibility !== "mapped") continue;
    const owner = person.get(item.owner_id);
    if (!owner || owner.is_guest) continue;
    const shown = rows.showings
      .filter((showing) => showing.work_item_id === item.id && showing.engagement_id === boardId)
      .map((showing) => ({ on: showing.shown_on, occasion: showing.occasion }))
      .sort((a, b) => a.on.localeCompare(b.on));
    const grade = firmGrade(firmMemoryOf({ type: item.type, meta: item.meta, shownToClient: shown.length > 0 }), askerOn.has(boardId), item.type);
    if (!grade) continue;
    const meta = item.meta && typeof item.meta === "object" ? (item.meta as Record<string, unknown>) : {};
    const card = latest.get(item.id);
    items.push({
      id: item.id,
      boardId,
      type: item.type,
      title: item.display_title || item.title,
      date: item.work_date,
      summary: card?.summary ?? null,
      decisions: card?.decisions ?? null,
      entities: card?.entities ?? null,
      grade,
      shown,
      sowFacts: meta["sow_facts"] && typeof meta["sow_facts"] === "object" ? (meta["sow_facts"] as Record<string, unknown>) : null,
      kind: typeof meta["deliverable_kind"] === "string" ? meta["deliverable_kind"] : null,
      situation: situationOf(meta),
      methods: methodsOf(meta),
      role: roleOf(meta),
      stage: stageOf(meta),
      ...(marked.has(`${boardId}:${item.id}`) ? { exemplar: true } : {}),
      ...(isProposalDraft(meta) ? { proposalDraft: { gist: draftGistOf(meta) } } : {}),
    });
  }

  const boards: FirmBoard[] = rows.boards.map((board) => ({
    id: board.id,
    title: board.title,
    client: board.clients && !board.clients.quick_folder ? board.clients.name : null,
    brief: board.brief,
    lead: board.owner_id ? (person.get(board.owner_id)?.display_name ?? null) : null,
    startedOn: board.created_at.slice(0, 10),
    outcome: board.outcome,
    askerIsOnBoard: askerOn.has(board.id),
  }));
  return { orgId, boards, items };
}

async function inPages<T>(ids: string[], read: (page: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += ID_PAGE) {
    const { data, error } = await read(ids.slice(i, i + ID_PAGE));
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
  }
  return out;
}

/**
 * Exemplar marks on the shared boards just read, by item and board only: the column that says who marked is never
 * selected. A mark is decoration on work the reader already has, so a failed read shows no marks rather than taking
 * the firm reader down.
 */
async function readExemplarMarks(admin: Db, orgId: string, boardIds: string[], itemIds: string[]): Promise<NonNullable<FirmRows["exemplars"]>> {
  const shared = new Set(boardIds);
  try {
    const rows = await inPages(itemIds, (page) =>
      admin.from("firm_exemplars").select("work_item_id, engagement_id").eq("org_id", orgId).in("work_item_id", page),
    );
    return rows.filter((row) => shared.has(row.engagement_id));
  } catch {
    return [];
  }
}

/** Reads what the firm may read, for one asker. Call only with the admin client from requireFirmMember. */
export async function readFirmCorpus(admin: Db, asker: ResolvedProfile): Promise<FirmCorpus> {
  const orgId = asker.org_id;
  const { data: boards, error } = await admin
    .from("engagements")
    .select("id, title, brief, owner_id, outcome, created_at, clients(name, quick_folder)")
    .eq("org_id", orgId)
    .eq("shared_with_firm", true)
    .is("archived_at", null);
  if (error) throw new Error(error.message);
  const boardRows = (boards ?? []) as unknown as FirmRows["boards"];
  if (!boardRows.length) return { orgId, boards: [], items: [] };
  const boardIds = boardRows.map((board) => board.id);

  const placed = await inPages(boardIds, (page) =>
    admin
      .from("work_item_tasks")
      .select("work_item_id, tasks!inner(engagement_id), work_items!inner(visibility)")
      .in("tasks.engagement_id", page)
      .eq("work_items.visibility", "mapped"),
  );
  const placements = (placed as unknown as { work_item_id: string; tasks: { engagement_id: string } }[]).map((row) => ({
    work_item_id: row.work_item_id,
    engagement_id: row.tasks.engagement_id,
  }));
  const itemIds = [...new Set(placements.map((row) => row.work_item_id))];

  // PERF-4: these five reads need only the board and item ids already in hand, so they run together instead of one
  // after another. The same rows are read with the same filters; only the waiting changed.
  const [itemRows, extracts, showings, exemplars, { data: memberships }] = await Promise.all([
    inPages(itemIds, (page) =>
      admin.from("work_items").select("id, owner_id, type, title, display_title, visibility, work_date, meta").eq("org_id", orgId).in("id", page),
    ),
    inPages(itemIds, (page) =>
      admin.from("work_item_extracts").select("work_item_id, summary, decisions, entities, created_at").in("work_item_id", page),
    ),
    inPages(itemIds, (page) =>
      admin.from("client_showings").select("work_item_id, engagement_id, shown_on, occasion").eq("org_id", orgId).in("work_item_id", page),
    ),
    readExemplarMarks(admin, orgId, boardIds, itemIds),
    admin.from("engagement_members").select("engagement_id").eq("profile_id", asker.id).in("engagement_id", boardIds),
  ]);
  // F2: SOW fees live in a table only the server reads; put them back here, where pastFees and Ask decide who sees them.
  const { withFeeTerms } = await import("./fee-terms.server");
  const items = await withFeeTerms(admin, itemRows);
  const peopleIds = [...new Set([...items.map((item) => item.owner_id), ...boardRows.map((board) => board.owner_id)].filter((id): id is string => Boolean(id)))];
  const people = await inPages(peopleIds, (page) => admin.from("profiles").select("id, display_name, is_guest").eq("org_id", orgId).in("id", page));
  const askerBoards = [
    ...(memberships ?? []).map((row) => row.engagement_id),
    ...boardRows.filter((board) => board.owner_id === asker.id).map((board) => board.id),
  ];

  return assembleFirmCorpus(orgId, { boards: boardRows, placements, items, extracts, showings, exemplars, people, askerBoards });
}

/**
 * Everyone in the firm's workspace by display name, guests included, so a walk-through can refuse any line that names
 * one of them. Names only, and only for that check: they are never sent to a model or shown.
 */
export async function readFirmPeopleNames(admin: Db, orgId: string): Promise<string[]> {
  const { data, error } = await admin.from("profiles").select("display_name").eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => (row.display_name ?? "").trim()).filter((name) => name.length > 1))];
}

/**
 * The text of one item the corpus lets the asker quote. Anything else, including summary-only items, returns null:
 * a summary-only body is never loaded, so it can never be quoted by mistake.
 */
export async function readFirmItemText(admin: Db, corpus: FirmCorpus, itemId: string): Promise<string | null> {
  const item = corpus.items.find((entry) => entry.id === itemId);
  if (!item || item.grade !== "full") return null;
  const { data, error } = await admin.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", itemId).eq("org_id", corpus.orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const result = await getItemText(admin, data as unknown as TextItem);
  return result.text ?? null;
}
