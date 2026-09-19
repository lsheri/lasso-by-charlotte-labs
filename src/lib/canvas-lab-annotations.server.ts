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
  validateHighlightRange,
  type AnnotationMutationResult,
  type HighlightDto,
} from "@/lib/canvas-lab-annotations-shared";
import { ensureBoard, ensureWorkItemNode, findBoardFor, isEngagementEditor } from "@/lib/canvas-lab.server";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;

const ANNOTATION_COLUMNS =
  "id, work_item_id, turn_no, char_start, char_end, excerpt, turn_hash, version, created_at";

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
};

function highlightDto(row: AnnotationRow): HighlightDto {
  return {
    id: row.id,
    workItemId: row.work_item_id ?? "",
    turnNo: row.turn_no ?? 0,
    charStart: row.char_start ?? 0,
    charEnd: row.char_end ?? 0,
    excerpt: row.excerpt ?? "",
    turnHash: row.turn_hash,
    version: row.version,
    createdAt: row.created_at,
  };
}

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
    .eq("author_profile_id", profile.id)
    .is("archived_at", null)
    .order("turn_no", { ascending: true })
    .order("char_start", { ascending: true });
  return ((data ?? []) as AnnotationRow[]).map(highlightDto);
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
      visibility: "just_me",
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(ANNOTATION_COLUMNS)
    .single();

  if (data) return { status: "saved", highlight: highlightDto(data as AnnotationRow) };

  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(ANNOTATION_COLUMNS)
        .eq("workboard_id", board.id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing) return { status: "saved", highlight: highlightDto(existing as AnnotationRow) };
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
