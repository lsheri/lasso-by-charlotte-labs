/**
 * S2 (stickies on the work, 10 Nov): stickies, server side.
 *
 * Everything runs on the caller-scoped client, so row level security decides what can be read and
 * written, exactly as for comments and highlights. Authorship comes from the verified session profile,
 * and every change is limited to the author here as well as in the database.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isStaleHighlight, type AnnotationVisibility } from "@/lib/canvas-lab-annotations-shared";
import {
  boardSeatFor,
  ensureBoard,
  ensureWorkItemNode,
  findBoardFor,
  isEngagementEditor,
} from "@/lib/canvas-lab.server";
import type { ResolvedProfile } from "@/lib/profile-resolve";
import {
  anchorColumns,
  anchorFromRow,
  clampUnit,
  isStickyFill,
  validateStickyAnchor,
  validateStickyBody,
  type StickyAnchor,
  type StickyDto,
  type StickyMutationResult,
} from "@/lib/stickies-shared";
import type { WorkboardStickyFill } from "@/lib/canvas-lab-shared";

type Db = SupabaseClient<Database>;

const STICKY_COLUMNS =
  "id, work_item_id, anchor_kind, page_no, turn_no, section_key, row_key, turn_hash, pos_x, pos_y, fill, body, visibility, author_profile_id, done_at, version, created_at";

type StickyRow = {
  id: string;
  work_item_id: string | null;
  anchor_kind: string | null;
  page_no: number | null;
  turn_no: number | null;
  section_key: string | null;
  row_key: string | null;
  turn_hash: string | null;
  pos_x: number | null;
  pos_y: number | null;
  fill: string | null;
  body: string | null;
  visibility: string | null;
  author_profile_id: string;
  done_at: string | null;
  version: number;
  created_at: string;
};

export function stickyDto(
  row: StickyRow,
  viewerProfileId: string,
  authorName: string,
  contentHash?: string | null,
): StickyDto {
  return {
    id: row.id,
    workItemId: row.work_item_id ?? "",
    anchor: anchorFromRow(row),
    posX: clampUnit(row.pos_x ?? 0.5),
    posY: clampUnit(row.pos_y ?? 0.5),
    fill: isStickyFill(row.fill) ? row.fill : "yellow",
    body: row.body ?? "",
    visibility: row.visibility === "just_me" ? "just_me" : "engagement",
    isMine: row.author_profile_id === viewerProfileId,
    authorName,
    doneAt: row.done_at,
    stale:
      row.anchor_kind === "turn"
        ? isStaleHighlight(row.turn_hash, contentHash ?? row.turn_hash)
        : false,
    version: row.version,
    createdAt: row.created_at,
  };
}

/** SH-7b: on a shared board, the caller's own guest seat writes and owns stickies, as with comments. */
async function seatForSticky(
  db: Db,
  id: string,
  profile: ResolvedProfile,
): Promise<ResolvedProfile> {
  if (!id) return profile;
  const { data: row } = await db
    .from("workboard_annotations")
    .select("workboard_id")
    .eq("id", id)
    .maybeSingle();
  const boardId = (row as { workboard_id?: string } | null)?.workboard_id;
  if (!boardId) return profile;
  const { data: board } = await db
    .from("workboards")
    .select("engagement_id")
    .eq("id", boardId)
    .maybeSingle();
  const engagementId = (board as { engagement_id?: string } | null)?.engagement_id;
  return engagementId ? boardSeatFor(db, engagementId, profile) : profile;
}

/** Every sticky on one piece of work on this board that the reader may see: their own, and the team's. */
export async function listStickies(
  db: Db,
  engagementId: string,
  workItemId: string,
  profile: ResolvedProfile,
): Promise<StickyDto[]> {
  profile = await boardSeatFor(db, engagementId, profile);
  const board = await findBoardFor(db, engagementId);
  if (!board || !workItemId) return [];
  const { data } = await db
    .from("workboard_annotations")
    .select(STICKY_COLUMNS)
    .eq("workboard_id", board.id)
    .eq("work_item_id", workItemId)
    .eq("kind", "sticky")
    .is("archived_at", null)
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as unknown as StickyRow[];
  if (rows.length === 0) return [];
  const turnNos = [
    ...new Set(
      rows
        .filter((row) => row.anchor_kind === "turn" && row.turn_no !== null)
        .map((row) => row.turn_no as number),
    ),
  ];
  const [{ data: turns }, { data: authors }] = await Promise.all([
    turnNos.length
      ? db
          .from("turns")
          .select("turn_no, content_hash")
          .eq("work_item_id", workItemId)
          .in("turn_no", turnNos)
      : Promise.resolve({ data: [] as { turn_no: number; content_hash: string | null }[] }),
    db
      .from("profiles")
      .select("id, display_name")
      .in("id", [...new Set(rows.map((row) => row.author_profile_id))]),
  ]);
  const hashByTurn = new Map(
    (turns ?? []).map((turn) => [turn.turn_no, turn.content_hash ?? null]),
  );
  const nameById = new Map(
    (authors ?? []).map((row) => [row.id, row.display_name || "A colleague"]),
  );
  return rows.map((row) =>
    stickyDto(
      row,
      profile.id,
      row.author_profile_id === profile.id
        ? "You"
        : (nameById.get(row.author_profile_id) ?? "A colleague"),
      row.turn_no !== null ? (hashByTurn.get(row.turn_no) ?? null) : null,
    ),
  );
}

export type CreateStickyInput = {
  engagementId: string;
  workItemId: string;
  anchor: StickyAnchor;
  posX: number;
  posY: number;
  fill: WorkboardStickyFill;
  body: string;
  visibility: AnnotationVisibility;
  clientKey: string;
};

export async function createSticky(
  db: Db,
  profile: ResolvedProfile,
  input: CreateStickyInput,
): Promise<StickyMutationResult> {
  profile = await boardSeatFor(db, input.engagementId, profile);
  if (!input.workItemId || !input.clientKey)
    return { status: "validation_error", message: "That spot could not be read." };
  const badAnchor = validateStickyAnchor(input.anchor);
  if (badAnchor) return { status: "validation_error", message: badAnchor };
  const badBody = validateStickyBody(input.body ?? "");
  if (badBody) return { status: "validation_error", message: badBody };
  if (!isStickyFill(input.fill))
    return { status: "validation_error", message: "Pick one of the sticky colours." };
  if (!(await isEngagementEditor(db, input.engagementId, profile.id)))
    return { status: "forbidden" };

  // A turn sticky remembers the turn as it was, so a changed turn can say so instead of pointing wrong.
  let turnHash: string | null = null;
  if (input.anchor.kind === "turn") {
    const { data: turn } = await db
      .from("turns")
      .select("content_hash")
      .eq("work_item_id", input.workItemId)
      .eq("turn_no", input.anchor.turnNo)
      .maybeSingle();
    if (!turn) return { status: "validation_error", message: "That turn is no longer available." };
    turnHash = turn.content_hash ?? null;
  }

  const board = await ensureBoard(db, input.engagementId, profile);
  if (!board) return { status: "forbidden" };
  const nodeId = await ensureWorkItemNode(db, board.id, profile.id, input.workItemId);

  const { data, error } = await db
    .from("workboard_annotations")
    .insert({
      workboard_id: board.id,
      node_id: nodeId,
      work_item_id: input.workItemId,
      kind: "sticky",
      ...anchorColumns(input.anchor),
      turn_hash: turnHash,
      pos_x: clampUnit(input.posX),
      pos_y: clampUnit(input.posY),
      fill: input.fill,
      body: input.body.trim(),
      visibility: input.visibility === "just_me" ? "just_me" : "engagement",
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(STICKY_COLUMNS)
    .single();

  if (data)
    return { status: "saved", sticky: stickyDto(data as unknown as StickyRow, profile.id, "You") };
  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(STICKY_COLUMNS)
        .eq("workboard_id", board.id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing)
      return {
        status: "saved",
        sticky: stickyDto(existing as unknown as StickyRow, profile.id, "You"),
      };
  }
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "validation_error", message: "That sticky could not be saved." };
}

/** What the author can change: the words, the colour, who sees it, and where it sits on its spot. */
export type EditStickyInput = {
  id: string;
  expectedVersion: number;
  body?: string | undefined;
  fill?: WorkboardStickyFill | undefined;
  visibility?: AnnotationVisibility | undefined;
  posX?: number | undefined;
  posY?: number | undefined;
};

export async function editSticky(
  db: Db,
  profile: ResolvedProfile,
  input: EditStickyInput,
): Promise<StickyMutationResult> {
  profile = await seatForSticky(db, input.id, profile);
  if (!input.id || !Number.isInteger(input.expectedVersion))
    return { status: "validation_error", message: "That sticky could not be read." };
  const patch: Database["public"]["Tables"]["workboard_annotations"]["Update"] = {
    updated_by: profile.id,
  };
  if (input.body !== undefined) {
    const bad = validateStickyBody(input.body);
    if (bad) return { status: "validation_error", message: bad };
    patch.body = input.body.trim();
  }
  if (input.fill !== undefined) {
    if (!isStickyFill(input.fill))
      return { status: "validation_error", message: "Pick one of the sticky colours." };
    patch.fill = input.fill;
  }
  if (input.visibility !== undefined) {
    patch.visibility = input.visibility === "just_me" ? "just_me" : "engagement";
    // A just-me sticky is never assigned (the database says so too).
    if (patch.visibility === "just_me") patch.assignee_profile_id = null;
  }
  if (input.posX !== undefined) patch.pos_x = clampUnit(input.posX);
  if (input.posY !== undefined) patch.pos_y = clampUnit(input.posY);

  const { data, error } = await db
    .from("workboard_annotations")
    .update(patch)
    .eq("id", input.id)
    .eq("kind", "sticky")
    .eq("author_profile_id", profile.id)
    .eq("version", input.expectedVersion)
    .is("archived_at", null)
    .select(STICKY_COLUMNS)
    .maybeSingle();
  if (data)
    return { status: "saved", sticky: stickyDto(data as unknown as StickyRow, profile.id, "You") };
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

/** Removing a sticky archives it, as with comments; only its author can. */
export async function archiveSticky(
  db: Db,
  profile: ResolvedProfile,
  id: string,
  expectedVersion: number,
): Promise<StickyMutationResult> {
  profile = await seatForSticky(db, id, profile);
  if (!id || !Number.isInteger(expectedVersion))
    return { status: "validation_error", message: "That sticky could not be read." };
  const { data, error } = await db
    .from("workboard_annotations")
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
      archive_reason: "author_removed",
      updated_by: profile.id,
    })
    .eq("id", id)
    .eq("kind", "sticky")
    .eq("author_profile_id", profile.id)
    .eq("version", expectedVersion)
    .is("archived_at", null)
    .select(STICKY_COLUMNS)
    .maybeSingle();
  if (data)
    return { status: "saved", sticky: stickyDto(data as unknown as StickyRow, profile.id, "You") };
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

/**
 * S3: open stickies per piece of work on this board that the reader may see (their own, and the team's).
 * A count about the work, for the corner sticky on its card. Never per person.
 */
export async function listStickyCounts(
  db: Db,
  engagementId: string,
): Promise<Record<string, number>> {
  const board = await findBoardFor(db, engagementId);
  if (!board) return {};
  const { data } = await db
    .from("workboard_annotations")
    .select("work_item_id")
    .eq("workboard_id", board.id)
    .eq("kind", "sticky")
    .is("done_at", null)
    .is("archived_at", null);
  const counts: Record<string, number> = {};
  for (const row of (data ?? []) as { work_item_id: string | null }[]) {
    if (!row.work_item_id) continue;
    counts[row.work_item_id] = (counts[row.work_item_id] ?? 0) + 1;
  }
  return counts;
}
