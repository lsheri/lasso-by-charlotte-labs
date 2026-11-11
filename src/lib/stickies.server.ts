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
  STICKY_COPY,
  validateStickyAnchor,
  validateStickyBody,
  type StickyAnchor,
  type StickyDto,
  type StickyMutationResult,
} from "@/lib/stickies-shared";
import type { WorkboardStickyFill } from "@/lib/canvas-lab-shared";
import {
  notifyStickyAssigned,
  notifyStickyDone,
  type StickyNotice,
} from "@/lib/sticky-notifications.server";

type Db = SupabaseClient<Database>;

const STICKY_COLUMNS =
  "id, work_item_id, anchor_kind, page_no, turn_no, section_key, row_key, turn_hash, source_hash, pos_x, pos_y, fill, body, visibility, author_profile_id, assignee_profile_id, done_at, done_by, version, created_at";

type StickyRow = {
  id: string;
  work_item_id: string | null;
  anchor_kind: string | null;
  page_no: number | null;
  turn_no: number | null;
  section_key: string | null;
  row_key: string | null;
  turn_hash: string | null;
  /** S5: the work's content hash when the sticky was left (non-turn anchors), to tell when the work has changed. */
  source_hash: string | null;
  pos_x: number | null;
  pos_y: number | null;
  fill: string | null;
  body: string | null;
  visibility: string | null;
  author_profile_id: string;
  assignee_profile_id: string | null;
  done_at: string | null;
  done_by: string | null;
  version: number;
  created_at: string;
};

/** A name for a profile as the reader sees it: "You" for themselves. */
function nameFor(
  id: string | null,
  viewerProfileId: string,
  names?: ReadonlyMap<string, string>,
): string | null {
  if (!id) return null;
  if (id === viewerProfileId) return "You";
  return names?.get(id) ?? "A colleague";
}

export function stickyDto(
  row: StickyRow,
  viewerProfileId: string,
  authorName: string,
  contentHash?: string | null,
  names?: ReadonlyMap<string, string>,
  /** S5: the work's content hash now, for stickies on a page, section, row, picture or the whole piece. */
  itemHash?: string | null,
): StickyDto {
  const isMine = row.author_profile_id === viewerProfileId;
  const isAssignedToMe = row.assignee_profile_id === viewerProfileId;
  return {
    id: row.id,
    workItemId: row.work_item_id ?? "",
    anchor: anchorFromRow(row),
    posX: clampUnit(row.pos_x ?? 0.5),
    posY: clampUnit(row.pos_y ?? 0.5),
    fill: isStickyFill(row.fill) ? row.fill : "yellow",
    body: row.body ?? "",
    visibility: row.visibility === "just_me" ? "just_me" : "engagement",
    isMine,
    authorName,
    assigneeId: row.assignee_profile_id,
    assigneeName: nameFor(row.assignee_profile_id, viewerProfileId, names),
    isAssignedToMe,
    canMarkDone: isMine || isAssignedToMe,
    doneAt: row.done_at,
    doneByName: nameFor(row.done_by, viewerProfileId, names),
    stale:
      row.anchor_kind === "turn"
        ? isStaleHighlight(row.turn_hash, contentHash ?? row.turn_hash)
        : workChangedSince(row.source_hash, itemHash),
    version: row.version,
    createdAt: row.created_at,
  };
}

/**
 * S5: a sticky on a page, section, row, picture or the whole piece remembers the work's content hash when it was
 * left. A different hash now means the work changed under it (a new version, a re-import), so the sticky says so.
 * The work is compared as a whole: Lasso cannot yet tell which page changed. Unknown on either side is not a change.
 */
export function workChangedSince(leftOn: string | null | undefined, now: string | null | undefined): boolean {
  return Boolean(leftOn && now && leftOn !== now);
}

/** SH-7b: on a shared board, the caller's own guest seat writes and owns stickies, as with comments. */
async function seatForSticky(
  db: Db,
  id: string,
  profile: ResolvedProfile,
): Promise<ResolvedProfile> {
  return (await stickySeat(db, id, profile)).profile;
}

/** The caller's seat on the sticky's board, and that board's engagement. */
async function stickySeat(
  db: Db,
  id: string,
  profile: ResolvedProfile,
): Promise<{ profile: ResolvedProfile; engagementId: string | null }> {
  if (!id) return { profile, engagementId: null };
  const { data: row } = await db
    .from("workboard_annotations")
    .select("workboard_id")
    .eq("id", id)
    .maybeSingle();
  const boardId = (row as { workboard_id?: string } | null)?.workboard_id;
  if (!boardId) return { profile, engagementId: null };
  const { data: board } = await db
    .from("workboards")
    .select("engagement_id")
    .eq("id", boardId)
    .maybeSingle();
  const engagementId = (board as { engagement_id?: string } | null)?.engagement_id ?? null;
  return {
    profile: engagementId ? await boardSeatFor(db, engagementId, profile) : profile,
    engagementId,
  };
}

/** Display names for the people a set of stickies mentions by id: authors, assignees, who marked done. */
async function namesFor(db: Db, rows: readonly StickyRow[]): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      rows.flatMap((row) => [row.author_profile_id, row.assignee_profile_id, row.done_by]).filter(
        (id): id is string => !!id,
      ),
    ),
  ];
  if (!ids.length) return new Map();
  const { data } = await db.from("profiles").select("id, display_name").in("id", ids);
  return new Map((data ?? []).map((row) => [row.id, row.display_name || "A colleague"]));
}

/** S4: an assignee has to be on the board (the database checks this too). Yourself always counts. */
async function onBoard(
  db: Db,
  engagementId: string,
  profileId: string,
  assigneeId: string,
): Promise<boolean> {
  if (assigneeId === profileId) return true;
  const { data, error } = await db.rpc("board_people", { p_engagement: engagementId });
  if (error || !Array.isArray(data)) return false;
  return data.some((person) => person.profile_id === assigneeId);
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
  const needsItemHash = rows.some((row) => row.anchor_kind !== "turn" && row.source_hash);
  const [{ data: turns }, names, { data: item }] = await Promise.all([
    turnNos.length
      ? db
          .from("turns")
          .select("turn_no, content_hash")
          .eq("work_item_id", workItemId)
          .in("turn_no", turnNos)
      : Promise.resolve({ data: [] as { turn_no: number; content_hash: string | null }[] }),
    namesFor(db, rows),
    needsItemHash
      ? db.from("work_items").select("content_hash").eq("id", workItemId).maybeSingle()
      : Promise.resolve({ data: null as { content_hash: string | null } | null }),
  ]);
  const hashByTurn = new Map(
    (turns ?? []).map((turn) => [turn.turn_no, turn.content_hash ?? null]),
  );
  return rows.map((row) =>
    stickyDto(
      row,
      profile.id,
      nameFor(row.author_profile_id, profile.id, names) ?? "A colleague",
      row.turn_no !== null ? (hashByTurn.get(row.turn_no) ?? null) : null,
      names,
      item?.content_hash ?? null,
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
  /** S4: someone on the board this sticky asks to act. Only on a board-visible sticky. */
  assigneeProfileId?: string | null | undefined;
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
  const assigneeId = input.assigneeProfileId || null;
  if (assigneeId) {
    if (input.visibility === "just_me")
      return { status: "validation_error", message: STICKY_COPY.justMeUnassigned };
    if (!(await onBoard(db, input.engagementId, profile.id, assigneeId)))
      return { status: "validation_error", message: STICKY_COPY.notOnBoard };
  }

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

  // S5: any other sticky remembers the work as it was, so a changed work can say so too.
  let sourceHash: string | null = null;
  if (input.anchor.kind !== "turn") {
    const { data: item } = await db
      .from("work_items")
      .select("content_hash")
      .eq("id", input.workItemId)
      .maybeSingle();
    sourceHash = item?.content_hash ?? null;
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
      source_hash: sourceHash,
      pos_x: clampUnit(input.posX),
      pos_y: clampUnit(input.posY),
      fill: input.fill,
      body: input.body.trim(),
      visibility: input.visibility === "just_me" ? "just_me" : "engagement",
      assignee_profile_id: assigneeId,
      author_profile_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
      client_key: input.clientKey,
    })
    .select(STICKY_COLUMNS)
    .single();

  if (data) {
    const row = data as unknown as StickyRow;
    // Only a fresh save notifies; a retried save with the same client key does not ask twice.
    if (assigneeId)
      await notifyStickyAssigned(db, profile, noticeFor(input.engagementId, row), assigneeId);
    return { status: "saved", sticky: stickyDto(row, profile.id, "You", null, await namesFor(db, [row])) };
  }
  if (error?.code === "23505") {
    const existing = (
      await db
        .from("workboard_annotations")
        .select(STICKY_COLUMNS)
        .eq("workboard_id", board.id)
        .eq("client_key", input.clientKey)
        .maybeSingle()
    ).data;
    if (existing) {
      const row = existing as unknown as StickyRow;
      return {
        status: "saved",
        sticky: stickyDto(row, profile.id, "You", null, await namesFor(db, [row])),
      };
    }
  }
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "validation_error", message: "That sticky could not be saved." };
}

/**
 * What the author can change: the words, the colour, who sees it, where it sits on its spot, and (S4) who
 * it asks to act. Choosing someone new reopens a done sticky, since it now asks something of them.
 */
export type EditStickyInput = {
  id: string;
  expectedVersion: number;
  body?: string | undefined;
  fill?: WorkboardStickyFill | undefined;
  visibility?: AnnotationVisibility | undefined;
  posX?: number | undefined;
  posY?: number | undefined;
  /** S4: undefined leaves it as it is; null clears it. */
  assigneeProfileId?: string | null | undefined;
};

export async function editSticky(
  db: Db,
  profile: ResolvedProfile,
  input: EditStickyInput,
): Promise<StickyMutationResult> {
  const seat = await stickySeat(db, input.id, profile);
  profile = seat.profile;
  if (!input.id || !Number.isInteger(input.expectedVersion))
    return { status: "validation_error", message: "That sticky could not be read." };
  // S4: a change of assignee, when the caller asked for one and it differs from what is saved.
  let assigneeChange: { to: string | null } | null = null;
  if (input.assigneeProfileId !== undefined) {
    const before = (
      await db
        .from("workboard_annotations")
        .select("assignee_profile_id, visibility")
        .eq("id", input.id)
        .eq("kind", "sticky")
        .eq("author_profile_id", profile.id)
        .maybeSingle()
    ).data as { assignee_profile_id: string | null; visibility: string | null } | null;
    if (!before) return { status: "conflict" };
    const next = input.assigneeProfileId || null;
    if (next !== before.assignee_profile_id) {
      const visibility = input.visibility ?? before.visibility;
      if (next && visibility === "just_me")
        return { status: "validation_error", message: STICKY_COPY.justMeUnassigned };
      if (next && (!seat.engagementId || !(await onBoard(db, seat.engagementId, profile.id, next))))
        return { status: "validation_error", message: STICKY_COPY.notOnBoard };
      assigneeChange = { to: next };
    }
  }
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
  // Going just-me already cleared the assignee above; otherwise a new assignee reopens the sticky.
  if (assigneeChange && patch.visibility !== "just_me") {
    patch.assignee_profile_id = assigneeChange.to;
    patch.done_at = null;
    patch.done_by = null;
  }

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
  if (data) {
    const row = data as unknown as StickyRow;
    if (assigneeChange?.to && row.assignee_profile_id === assigneeChange.to && seat.engagementId)
      await notifyStickyAssigned(db, profile, noticeFor(seat.engagementId, row), assigneeChange.to);
    return { status: "saved", sticky: stickyDto(row, profile.id, "You", null, await namesFor(db, [row])) };
  }
  if (error?.code === "42501") return { status: "forbidden" };
  return { status: "conflict" };
}

/** The caller's own "left you a sticky" row, marked acted once the sticky is done. Best effort. */
async function settleAssignedNotice(db: Db, stickyId: string, profileId: string): Promise<void> {
  try {
    const { data } = await db
      .from("notifications")
      .select("id")
      .eq("group_key", `sticky:${stickyId}:assigned:${profileId}`)
      .is("acted_at", null);
    const ids = ((data ?? []) as { id: string }[]).map((row) => row.id);
    if (ids.length) await db.rpc("mark_notifications", { p_ids: ids, p_acted: true });
  } catch {
    // The sticky is done either way.
  }
}

/** What a notification needs to name the spot. */
function noticeFor(engagementId: string, row: StickyRow): StickyNotice {
  return {
    engagementId,
    stickyId: row.id,
    workItemId: row.work_item_id ?? "",
    anchor: anchorFromRow(row),
  };
}

/**
 * S4: mark a sticky done, or reopen it. The assignee does this, and the author can always close their own.
 * Runs through set_sticky_done, which checks who is calling; the database guard checks again that nothing
 * but done moves. Marking done tells the author (when someone else did it) and the board, once.
 *
 * S4b-2: from the inbox there is no version in hand (null), so the current one is read first. Marking done
 * also settles the caller's own "left you a sticky" notification, wherever the tick happened.
 */
export async function setStickyDone(
  db: Db,
  profile: ResolvedProfile,
  id: string,
  done: boolean,
  expectedVersion: number | null,
): Promise<StickyMutationResult> {
  const seat = await stickySeat(db, id, profile);
  profile = seat.profile;
  if (!id) return { status: "validation_error", message: "That sticky could not be read." };
  if (expectedVersion === null) {
    const current = (
      await db.from("workboard_annotations").select("version").eq("id", id).eq("kind", "sticky").maybeSingle()
    ).data as { version: number } | null;
    if (!current) return { status: "conflict" };
    expectedVersion = current.version;
  }
  if (!Number.isInteger(expectedVersion))
    return { status: "validation_error", message: "That sticky could not be read." };
  const { data: changed, error } = await db.rpc("set_sticky_done", {
    p_annotation: id,
    p_done: done,
    p_expected_version: expectedVersion,
  });
  if (error?.code === "42501") return { status: "forbidden" };
  if (error || !Array.isArray(changed) || changed.length === 0) return { status: "conflict" };
  const { data } = await db
    .from("workboard_annotations")
    .select(STICKY_COLUMNS)
    .eq("id", id)
    .eq("kind", "sticky")
    .maybeSingle();
  if (!data) return { status: "conflict" };
  const row = data as unknown as StickyRow;
  if (done && row.assignee_profile_id === profile.id) await settleAssignedNotice(db, id, profile.id);
  if (done && seat.engagementId)
    await notifyStickyDone(
      db,
      profile,
      noticeFor(seat.engagementId, row),
      row.author_profile_id,
      row.assignee_profile_id !== null,
    );
  const names = await namesFor(db, [row]);
  return {
    status: "saved",
    sticky: stickyDto(row, profile.id, nameFor(row.author_profile_id, profile.id, names) ?? "A colleague", null, names),
  };
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
