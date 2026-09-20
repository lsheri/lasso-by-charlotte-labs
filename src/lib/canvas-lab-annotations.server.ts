/**
 * Slice 2a unit 1: highlights on chat turns, server side.
 *
 * Everything runs on the caller-scoped client, so row level security decides
 * what can be read and written. Authorship comes from the verified session
 * profile. The excerpt and its hash are produced here from the stored turn, so
 * a browser can never decide what a highlight says it covers.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  annotationTextHash,
  excerptFor,
  isEdited,
  isStaleHighlight,
  validateCommentBody,
  validateHighlightRange,
  type AnnotationMutationResult,
  type CommentDto,
  type CommentMutationResult,
  type CommentThreadDto,
  type HighlightDto,
} from "@/lib/canvas-lab-annotations-shared";
import { ensureBoard, ensureWorkItemNode, findBoardFor, isEngagementEditor } from "@/lib/canvas-lab.server";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;

const ANNOTATION_COLUMNS =
  "id, work_item_id, turn_no, char_start, char_end, excerpt, turn_hash, version, created_at, visibility, author_profile_id";

type AnnotationRow = {
  id: string;
  work_item_id: string | null;
  turn_no: number | null;
  char_start: number | null;
  char_end: number | null;
  excerpt: string | null;
  turn_hash: string | null;
  version: number;
  created_at: string;
  visibility: string | null;
  author_profile_id: string;
};

function highlightDto(
  row: AnnotationRow,
  viewerProfileId: string,
  authorName: string,
  contentHash?: string | null,
): HighlightDto {
  return {
    stale: isStaleHighlight(row.turn_hash, contentHash ?? row.turn_hash),
    id: row.id,
    workItemId: row.work_item_id ?? "",
    turnNo: row.turn_no ?? 0,
    charStart: row.char_start ?? 0,
    charEnd: row.char_end ?? 0,
    excerpt: row.excerpt ?? "",
    turnHash: row.turn_hash,
    version: row.version,
    createdAt: row.created_at,
    visibility: row.visibility === "just_me" ? "just_me" : "engagement",
    isMine: row.author_profile_id === viewerProfileId,
    authorName,
  };
}

/**
 * Teammate visibility: the database decides what comes back. A reader sees
 * their own highlights plus any a teammate chose to share on an item the
 * reader can already open.
 */
export async function listMyAnnotations(
  db: Db,
  engagementId: string,
  workItemId: string,
  profile: ResolvedProfile,
): Promise<HighlightDto[]> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return [];
  const { data } = await db
    .from("workboard_annotations")
    .select(ANNOTATION_COLUMNS)
    .eq("workboard_id", board.id)
    .eq("work_item_id", workItemId)
    .eq("kind", "highlight")
    .is("archived_at", null)
    .order("turn_no", { ascending: true })
    .order("char_start", { ascending: true });
  const rows = (data ?? []) as AnnotationRow[];
  if (rows.length === 0) return [];

  const [{ data: turns }, { data: authors }] = await Promise.all([
    db.from("turns").select("turn_no, content_hash").eq("work_item_id", workItemId),
    db
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(rows.map((row) => row.author_profile_id))]),
  ]);
  const hashByTurn = new Map<number, string | null>(
    (turns ?? []).map((turn) => [turn.turn_no, turn.content_hash ?? null]),
  );
  const nameById = new Map<string, string>(
    (authors ?? []).map((row) => [row.id, row.display_name || "A colleague"]),
  );
  return rows.map((row) =>
    highlightDto(
      row,
      profile.id,
      row.author_profile_id === profile.id ? "You" : nameById.get(row.author_profile_id) ?? "A colleague",
      hashByTurn.get(row.turn_no ?? -1) ?? null,
    ),
  );
}


export type CreateHighlightInput = {
  engagementId: string;
  workItemId: string;
  turnNo: number;
  charStart: number;
  charEnd: number;
  clientKey: string;
};

export async function createHighlight(
  db: Db,
  profile: ResolvedProfile,
  input: CreateHighlightInput,
): Promise<AnnotationMutationResult> {
  if (!input.workItemId || !Number.isInteger(input.turnNo) || !input.clientKey) {
    return { status: "validation_error", message: "That selection could not be read." };
  }
  if (!(await isEngagementEditor(db, input.engagementId, profile.id))) return { status: "forbidden" };

  const { data: turn } = await db
    .from("turns")
    .select("content, content_hash")
    .eq("work_item_id", input.workItemId)
    .eq("turn_no", input.turnNo)
    .maybeSingle();
  if (!turn) return { status: "validation_error", message: "That turn is no longer available." };

  const invalid = validateHighlightRange(turn.content, input.charStart, input.charEnd);
  if (invalid) return { status: "validation_error", message: invalid };

  const board = await ensureBoard(db, input.engagementId, profile);
  if (!board) return { status: "forbidden" };
  const nodeId = await ensureWorkItemNode(db, board.id, profile.id, input.workItemId);

  const excerpt = excerptFor(turn.content, input.charStart, input.charEnd);
  const textHash = await annotationTextHash(excerpt);

  const { data, error } = await db
    .from("workboard_annotations")
    .insert({
      workboard_id: board.id,
      node_id: nodeId,
      work_item_id: input.workItemId,
      kind: "highlight",
      anchor_kind: "turn",
      turn_no: input.turnNo,
      turn_hash: turn.content_hash,
      char_start: input.charStart,
      char_end: input.charEnd,
      excerpt,
      text_hash: textHash,
      body: "",
      // Teammate visibility: a new highlight is shared with the engagement
      // team, and its author can set it back to just themselves.
      visibility: "engagement",
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(ANNOTATION_COLUMNS)
    .single();

  if (data) return { status: "saved", highlight: highlightDto(data as AnnotationRow, profile.id, "You") };

  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(ANNOTATION_COLUMNS)
        .eq("workboard_id", board.id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing) {
      return { status: "saved", highlight: highlightDto(existing as AnnotationRow, profile.id, "You") };
    }
  }

  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "validation_error", message: "That highlight could not be saved." };
}

export async function archiveHighlight(
  db: Db,
  profile: ResolvedProfile,
  id: string,
  expectedVersion: number,
): Promise<AnnotationMutationResult> {
  if (!id || !Number.isInteger(expectedVersion)) {
    return { status: "validation_error", message: "That highlight could not be read." };
  }
  const { data, error } = await db
    .from("workboard_annotations")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: "author_removed",
      updated_by: profile.id,
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .is("archived_at", null)
    .select(ANNOTATION_COLUMNS)
    .maybeSingle();
  if (data) return { status: "saved", highlight: highlightDto(data as AnnotationRow) };
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

/* -------------------------------------------------------------------------
 * Slice 2a unit 2: comments, replies, and the count behind a card's chip.
 *
 * A highlight is private. A comment is review, so it is written at engagement
 * visibility and everyone who can already see the item can read it. Only the
 * author edits or removes their own, which the database enforces as well.
 * ---------------------------------------------------------------------- */

const COMMENT_COLUMNS =
  "id, parent_id, work_item_id, turn_no, char_start, char_end, excerpt, turn_hash, body, author_profile_id, version, created_at, updated_at";

type CommentRow = {
  id: string;
  parent_id: string | null;
  work_item_id: string | null;
  turn_no: number | null;
  char_start: number | null;
  char_end: number | null;
  excerpt: string | null;
  turn_hash: string | null;
  body: string | null;
  author_profile_id: string;
  version: number;
  created_at: string;
  updated_at: string;
};

function commentDto(
  row: CommentRow,
  viewerProfileId: string,
  authorName: string,
  contentHash?: string | null,
): CommentDto {
  return {
    id: row.id,
    parentId: row.parent_id,
    authorProfileId: row.author_profile_id,
    authorName,
    isMine: row.author_profile_id === viewerProfileId,
    body: row.body ?? "",
    excerpt: row.excerpt ?? "",
    turnNo: row.turn_no,
    charStart: row.char_start,
    charEnd: row.char_end,
    stale: row.parent_id ? false : isStaleHighlight(row.turn_hash, contentHash ?? row.turn_hash),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    edited: isEdited(row.created_at, row.updated_at),
  };
}

/** The database speaks plainly about replies; pass its words straight through. */
function commentDbError(message: string | undefined): CommentMutationResult {
  const text = message ?? "";
  if (text.includes("Reply to a comment")) {
    return { status: "validation_error", message: "Reply to a comment, not to a reply." };
  }
  if (text.includes("was removed")) {
    return { status: "validation_error", message: "That comment was removed." };
  }
  return { status: "validation_error", message: "That comment could not be saved." };
}

export type CreateCommentInput = CreateHighlightInput & { body: string };

export async function createComment(
  db: Db,
  profile: ResolvedProfile,
  input: CreateCommentInput,
): Promise<CommentMutationResult> {
  if (!input.workItemId || !Number.isInteger(input.turnNo) || !input.clientKey) {
    return { status: "validation_error", message: "That selection could not be read." };
  }
  const badBody = validateCommentBody(input.body ?? "");
  if (badBody) return { status: "validation_error", message: badBody };
  if (!(await isEngagementEditor(db, input.engagementId, profile.id))) return { status: "forbidden" };

  const { data: turn } = await db
    .from("turns")
    .select("content, content_hash")
    .eq("work_item_id", input.workItemId)
    .eq("turn_no", input.turnNo)
    .maybeSingle();
  if (!turn) return { status: "validation_error", message: "That turn is no longer available." };

  const invalid = validateHighlightRange(turn.content, input.charStart, input.charEnd);
  if (invalid) return { status: "validation_error", message: invalid };

  const board = await ensureBoard(db, input.engagementId, profile);
  if (!board) return { status: "forbidden" };
  const nodeId = await ensureWorkItemNode(db, board.id, profile.id, input.workItemId);

  const excerpt = excerptFor(turn.content, input.charStart, input.charEnd);
  const textHash = await annotationTextHash(excerpt);

  const { data, error } = await db
    .from("workboard_annotations")
    .insert({
      workboard_id: board.id,
      node_id: nodeId,
      work_item_id: input.workItemId,
      kind: "comment",
      anchor_kind: "turn",
      turn_no: input.turnNo,
      turn_hash: turn.content_hash,
      char_start: input.charStart,
      char_end: input.charEnd,
      excerpt,
      text_hash: textHash,
      body: input.body.trim(),
      visibility: "engagement",
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (data) {
    return { status: "saved", comment: commentDto(data as CommentRow, profile.id, "You") };
  }
  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(COMMENT_COLUMNS)
        .eq("workboard_id", board.id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing) return { status: "saved", comment: commentDto(existing as CommentRow, profile.id, "You") };
  }
  if (error?.code === "42501") return { status: "forbidden" };
  return commentDbError(error?.message);
}

export async function createReply(
  db: Db,
  profile: ResolvedProfile,
  input: { parentId: string; body: string; clientKey: string },
): Promise<CommentMutationResult> {
  if (!input.parentId || !input.clientKey) {
    return { status: "validation_error", message: "That comment could not be read." };
  }
  const badBody = validateCommentBody(input.body ?? "");
  if (badBody) return { status: "validation_error", message: badBody };

  const { data: parent } = await db
    .from("workboard_annotations")
    .select("id, workboard_id, work_item_id, node_id, parent_id, archived_at, visibility")
    .eq("id", input.parentId)
    .maybeSingle();
  if (!parent || parent.archived_at) {
    return { status: "validation_error", message: "That comment was removed." };
  }
  if (parent.parent_id) {
    return { status: "validation_error", message: "Reply to a comment, not to a reply." };
  }

  const { data, error } = await db
    .from("workboard_annotations")
    .insert({
      workboard_id: parent.workboard_id,
      node_id: parent.node_id,
      work_item_id: parent.work_item_id,
      parent_id: parent.id,
      kind: "comment",
      anchor_kind: "item",
      // The DB forces the parent's visibility; sending it keeps the row shape complete.
      visibility: parent.visibility,
      body: input.body.trim(),
      excerpt: "",
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(COMMENT_COLUMNS)
    .single();

  if (data) return { status: "saved", comment: commentDto(data as CommentRow, profile.id, "You") };
  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(COMMENT_COLUMNS)
        .eq("workboard_id", parent.workboard_id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing) return { status: "saved", comment: commentDto(existing as CommentRow, profile.id, "You") };
  }
  if (error?.code === "42501") return { status: "forbidden" };
  return commentDbError(error?.message);
}

export async function editComment(
  db: Db,
  profile: ResolvedProfile,
  id: string,
  body: string,
  expectedVersion: number,
): Promise<CommentMutationResult> {
  if (!id || !Number.isInteger(expectedVersion)) {
    return { status: "validation_error", message: "That comment could not be read." };
  }
  const badBody = validateCommentBody(body ?? "");
  if (badBody) return { status: "validation_error", message: badBody };

  const { data, error } = await db
    .from("workboard_annotations")
    .update({ body: body.trim(), updated_by: profile.id })
    .eq("id", id)
    .eq("version", expectedVersion)
    .is("archived_at", null)
    .select(COMMENT_COLUMNS)
    .maybeSingle();
  if (data) return { status: "saved", comment: commentDto(data as CommentRow, profile.id, "You") };
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

export async function archiveComment(
  db: Db,
  profile: ResolvedProfile,
  id: string,
  expectedVersion: number,
): Promise<CommentMutationResult> {
  if (!id || !Number.isInteger(expectedVersion)) {
    return { status: "validation_error", message: "That comment could not be read." };
  }
  const { data, error } = await db
    .from("workboard_annotations")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: "author_removed",
      updated_by: profile.id,
    })
    .eq("id", id)
    .eq("version", expectedVersion)
    .is("archived_at", null)
    .select(COMMENT_COLUMNS)
    .maybeSingle();
  if (data) return { status: "saved", comment: commentDto(data as CommentRow, profile.id, "You") };
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

export async function listComments(
  db: Db,
  engagementId: string,
  workItemId: string,
  profile: ResolvedProfile,
): Promise<CommentThreadDto[]> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return [];
  const { data } = await db
    .from("workboard_annotations")
    .select(COMMENT_COLUMNS)
    .eq("workboard_id", board.id)
    .eq("work_item_id", workItemId)
    .eq("kind", "comment")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as CommentRow[];
  if (rows.length === 0) return [];

  const [{ data: turns }, { data: authors }] = await Promise.all([
    db.from("turns").select("turn_no, content_hash").eq("work_item_id", workItemId),
    db
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(rows.map((row) => row.author_profile_id))]),
  ]);
  const hashByTurn = new Map<number, string | null>(
    (turns ?? []).map((turn) => [turn.turn_no, turn.content_hash ?? null]),
  );
  const nameById = new Map<string, string>(
    (authors ?? []).map((row) => [row.id, row.display_name || "A colleague"]),
  );
  const nameFor = (row: CommentRow) => nameById.get(row.author_profile_id) ?? "A colleague";

  const tops = rows.filter((row) => !row.parent_id);
  const liveTopIds = new Set(tops.map((row) => row.id));
  const threads: CommentThreadDto[] = tops.map((row) => ({
    ...commentDto(row, profile.id, nameFor(row), hashByTurn.get(row.turn_no ?? -1) ?? null),
    replies: [],
  }));
  const byId = new Map(threads.map((thread) => [thread.id, thread]));
  for (const row of rows) {
    if (!row.parent_id || !liveTopIds.has(row.parent_id)) continue;
    byId.get(row.parent_id)?.replies.push(commentDto(row, profile.id, nameFor(row)));
  }
  return threads;
}

/** One read behind every card's chip: live top-level comments per work item. */
export async function listCommentCounts(
  db: Db,
  engagementId: string,
): Promise<Record<string, number>> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return {};
  const { data } = await db
    .from("workboard_annotations")
    .select("work_item_id")
    .eq("workboard_id", board.id)
    .eq("kind", "comment")
    .is("parent_id", null)
    .is("archived_at", null);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { work_item_id: string | null }[]) {
    if (!row.work_item_id) continue;
    counts[row.work_item_id] = (counts[row.work_item_id] ?? 0) + 1;
  }
  return counts;
}
