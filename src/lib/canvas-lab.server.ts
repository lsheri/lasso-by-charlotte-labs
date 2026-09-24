/**
 * Canvas Lab Phase 3 Slice 1: server-side Workboard assembly and mutation.
 *
 * Everything runs on the caller-scoped client, so row level security decides
 * visibility. Authorship, org, and moderation rights are derived from the
 * verified session profile, never from browser-supplied ids. Canonical
 * records (work items, decisions, the brief) are referenced, never copied;
 * a reference the caller cannot read is omitted from the payload.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type {
  WorkboardCommand,
  WorkboardDto,
  WorkboardFrameDto,
  WorkboardFrameInput,
  WorkboardLinkDto,
  WorkboardMutationResult,
  WorkboardNodeDto,
  WorkboardNodeInput,
  WorkboardRowSnapshot,
} from "@/lib/canvas-lab-shared";
import { isRegionFill, isRegionFrameId } from "@/lib/board-region";
import { WORKBOARD_ANCHORS, WORKBOARD_CARD_DEFAULT_SIZE, WORKBOARD_JUDGMENT_TYPES, WORKBOARD_NODE_KINDS, WORKBOARD_RELATIONS, WORKBOARD_SHAPE_COLOURS, isWorkboardDecorationKind, parseWorkboardStickyBody, parseWorkboardTextBody, validWorkboardNodeGeometry } from "@/lib/canvas-lab-shared";
import type { ResolvedProfile } from "@/lib/profile-resolve";

type Db = SupabaseClient<Database>;
type BoardRow = Database["public"]["Tables"]["workboards"]["Row"];
type FrameRow = Database["public"]["Tables"]["workboard_frames"]["Row"];
type NodeRow = Database["public"]["Tables"]["workboard_nodes"]["Row"];
type LinkRow = Database["public"]["Tables"]["workboard_links"]["Row"];

type Membership = { isMember: boolean; isEditor: boolean };

async function membershipFor(db: Db, engagementId: string, profileId: string): Promise<Membership> {
  const { data } = await db
    .from("engagement_members")
    .select("member_role")
    .eq("engagement_id", engagementId)
    .eq("profile_id", profileId);
  const roles = (data ?? []).map((row) => row.member_role);
  return { isMember: roles.length > 0, isEditor: roles.some((role) => role !== "coach") };
}

async function findBoard(db: Db, engagementId: string): Promise<BoardRow | null> {
  const { data } = await db.from("workboards").select("*").eq("engagement_id", engagementId).maybeSingle();
  return data ?? null;
}

/** Slice 2a: annotations need the same board and the same editor test. */
export async function findBoardFor(db: Db, engagementId: string): Promise<BoardRow | null> {
  return findBoard(db, engagementId);
}

export async function isEngagementEditor(db: Db, engagementId: string, profileId: string): Promise<boolean> {
  return (await membershipFor(db, engagementId, profileId)).isEditor;
}

export async function ensureBoard(db: Db, engagementId: string, profile: ResolvedProfile): Promise<BoardRow | null> {
  const existing = await findBoard(db, engagementId);
  if (existing) return existing;
  const { error } = await db.from("workboards").insert({
    engagement_id: engagementId,
    org_id: profile.org_id,
    created_by: profile.id,
  });
  if (error && error.code !== "23505") return null;
  return findBoard(db, engagementId);
}

function frameDto(row: FrameRow): WorkboardFrameDto {
  return {
    id: row.id,
    key: row.key,
    kind: row.kind as WorkboardFrameDto["kind"],
    taskId: row.task_id,
    label: row.label,
    fill: row.fill ?? null,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    ord: row.ord,
    version: row.version,
  };
}

export async function loadWorkboard(db: Db, engagementId: string, profile: ResolvedProfile): Promise<WorkboardDto | null> {
  const membership = await membershipFor(db, engagementId, profile.id);
  if (!membership.isMember) return null;
  const board = await findBoard(db, engagementId);
  if (!board) {
    return {
      id: "",
      engagementId,
      version: 0,
      frames: [],
      nodes: [],
      links: [],
      viewerProfileId: profile.id,
      canEditStructure: membership.isEditor,
      archivedContextFrame: null,
    };
  }

  const [framesRes, nodesRes, linksRes] = await Promise.all([
    db.from("workboard_frames").select("*").eq("workboard_id", board.id).order("ord"),
    db.from("workboard_nodes").select("*").eq("workboard_id", board.id).is("deleted_at", null),
    db.from("workboard_links").select("*").eq("workboard_id", board.id).is("deleted_at", null),
  ]);
  const allFrameRows = (framesRes.data ?? []) as FrameRow[];
  const frameRows = allFrameRows.filter((row) => row.deleted_at === null);
  const archivedContext = allFrameRows.find((row) => row.kind === "context" && row.deleted_at !== null) ?? null;
  const nodeRows = (nodesRes.data ?? []) as NodeRow[];
  const linkRows = (linksRes.data ?? []) as LinkRow[];

  // Permission filtering: a reference the caller cannot read is dropped, and
  // so is every link that touches it. Nothing about the hidden record leaks.
  const workIds = [...new Set(nodeRows.map((row) => row.work_item_id).filter((id): id is string => !!id))];
  const decisionIds = [...new Set(nodeRows.map((row) => row.decision_id).filter((id): id is string => !!id))];
  const [workRes, decisionRes, authorRes] = await Promise.all([
    workIds.length > 0 ? db.from("work_items").select("id").in("id", workIds) : Promise.resolve({ data: [] as { id: string }[] }),
    decisionIds.length > 0 ? db.from("decisions").select("id").in("id", decisionIds) : Promise.resolve({ data: [] as { id: string }[] }),
    db.from("profiles").select("id, display_name").in("id", [...new Set(nodeRows.map((row) => row.author_profile_id))]),
  ]);
  const readableWork = new Set((workRes.data ?? []).map((row) => row.id));
  const readableDecisions = new Set((decisionRes.data ?? []).map((row) => row.id));
  const authorNames = new Map((authorRes.data ?? []).map((row) => [row.id, row.display_name]));

  const visibleNodes = nodeRows.filter((row) => {
    if (row.work_item_id) return readableWork.has(row.work_item_id);
    if (row.decision_id) return readableDecisions.has(row.decision_id);
    return true;
  });
  const visibleIds = new Set(visibleNodes.map((row) => row.id));
  const frameIds = new Set(frameRows.map((row) => row.id));

  const nodes: WorkboardNodeDto[] = visibleNodes.map((row) => ({
    id: row.id,
    frameId: row.frame_id && frameIds.has(row.frame_id) ? row.frame_id : null,
    kind: row.kind as WorkboardNodeDto["kind"],
    workItemId: row.work_item_id,
    decisionId: row.decision_id,
    authorProfileId: row.author_profile_id,
    authorName: authorNames.get(row.author_profile_id) ?? "A teammate",
    title: row.title,
    body: row.body,
    judgmentType: (row.judgment_type as WorkboardNodeDto["judgmentType"]) ?? null,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    hidden: row.hidden,
    version: row.version,
    referenceReadable: true,
    createdAt: row.created_at ?? null,
    linkedItemRemovedAt: row.linked_item_removed_at ?? null,
  }));
  const links: WorkboardLinkDto[] = linkRows
    .filter((row) => visibleIds.has(row.from_node_id) && visibleIds.has(row.to_node_id))
    .map((row) => ({
      id: row.id,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      fromAnchor: row.from_anchor as WorkboardLinkDto["fromAnchor"],
      toAnchor: row.to_anchor as WorkboardLinkDto["toAnchor"],
      relation: row.relation as WorkboardLinkDto["relation"],
      authorProfileId: row.author_profile_id,
      version: row.version,
    }));

  return {
    id: board.id,
    engagementId,
    version: board.version,
    frames: frameRows.map(frameDto),
    nodes,
    links,
    viewerProfileId: profile.id,
    canEditStructure: membership.isEditor,
    archivedContextFrame: archivedContext ? { id: archivedContext.id, version: archivedContext.version } : null,
  };
}

function conflict(entityKind: "frame" | "node" | "link", entityId: string, latest: WorkboardRowSnapshot & { version: number }): WorkboardMutationResult {
  return { status: "conflict", entityKind, entityId, latestVersion: latest.version, latest };
}

/** Rows are JSON-shaped; timestamps and ids arrive as strings. */
function snapshot<T extends { version: number }>(row: T): WorkboardRowSnapshot & { version: number } {
  return JSON.parse(JSON.stringify(row)) as WorkboardRowSnapshot & { version: number };
}

export function validNodeInput(node: WorkboardNodeInput): string | null {
  if (!WORKBOARD_NODE_KINDS.includes(node.kind)) return "Unknown workboard item kind.";
  if (node.kind === "mark") return "Marks are not available yet.";
  // W3: colour blocks were replaced by drawn regions, which are frames.
  if (node.kind === "shape") return "Draw a region on the board instead of a colour block.";
  if (!validWorkboardNodeGeometry(node)) return node.kind === "text" ? "Text block dimensions are outside the supported range." : node.kind === "sticky" ? "Sticky dimensions are outside the supported range." : "Card dimensions are outside the supported range.";
  if (node.kind === "work_item" && !node.workItemId) return "A work card needs its work item.";
  if (node.kind === "decision" && !node.decisionId) return "A decision card needs its decision.";
  if ((node.kind === "judgment" || node.kind === "draft") && (node.workItemId || node.decisionId)) return "An authored card cannot reference a record.";
  // A kept answer holds its own words and points at turns, never at a record.
  if (node.kind === "answer" && (node.workItemId || node.decisionId)) return "A kept answer cannot reference work or a decision.";
  if (node.kind === "answer" && !node.body?.trim()) return "A kept answer needs the answer it keeps.";
  if (node.kind === "text" && (node.workItemId || node.decisionId)) return "A text block cannot reference work or a decision.";
  if (node.kind === "text" && (node.frameKey || node.title || node.judgmentType)) return "A text block can only carry its words, style and rectangle.";
  if (node.kind === "text" && !parseWorkboardTextBody(node.body)) return "Check the text block words and style choices.";
  if (node.kind === "sticky" && (node.workItemId || node.decisionId)) return "A sticky cannot reference work or a decision.";
  if (node.kind === "sticky" && (node.frameKey || node.title || node.judgmentType)) return "A sticky can only carry its words, style, fill and rectangle.";
  if (node.kind === "sticky" && !parseWorkboardStickyBody(node.body)) return "Check the sticky words and style choices.";
  if (node.judgmentType && !WORKBOARD_JUDGMENT_TYPES.includes(node.judgmentType)) return "Unknown judgment type.";
  return null;
}

export function validateLinkNodeKinds(kinds: string[]): string | null {
  const decorationKind = kinds.find(isWorkboardDecorationKind);
  if (decorationKind === "shape") return "A colour block cannot be connected.";
  if (decorationKind === "text") return "A text block cannot be connected.";
  if (decorationKind === "mark") return "A mark cannot be connected.";
  if (decorationKind === "sticky") return "A sticky cannot be connected.";
  return null;
}

export function validNodeUpdate(kind: WorkboardNodeDto["kind"], patch: Extract<WorkboardCommand, { type: "node_update" }>["patch"]): string | null {
  if (kind === "mark") return "Marks are not available yet.";
  if (kind === "shape") return "Draw a region on the board instead of a colour block.";
  if (!validNodeGeometry(kind, patch)) return kind === "text" ? "Text block dimensions are outside the supported range." : "Card dimensions are outside the supported range.";
  if (kind === "text" && patch.body !== undefined && !parseWorkboardTextBody(patch.body)) return "Check the text block words and style choices.";
  if (kind === "sticky" && patch.body !== undefined && !parseWorkboardStickyBody(patch.body)) return "Check the sticky words and style choices.";
  if (kind === "sticky" && patch.title !== undefined) return "A sticky can only carry its words, style, fill and rectangle.";
  return null;
}

function validFrameGeometry(frame: { x?: number; y?: number; w?: number; h?: number }): boolean {
  const values = [frame.x, frame.y, frame.w, frame.h].filter((value): value is number => value !== undefined);
  if (!values.every(Number.isFinite)) return false;
  if (frame.w !== undefined && (frame.w < 260 || frame.w > 2400)) return false;
  return frame.h === undefined || (frame.h >= 220 && frame.h <= 1800);
}

/** W3: a region keeps its colour with or without a name. */
export function validateFrameFill(fill: unknown): string | null {
  if (fill === null || fill === undefined) return null;
  return isRegionFill(fill) ? null : "Choose one of the available region colours.";
}

export function validateFrameLabel(kind: string, label: unknown, options: { region?: boolean } = {}): string | null {
  // A drawn region may have its name cleared, which turns it back into paint.
  if (options.region && (label === null || (typeof label === "string" && label.trim().length === 0))) return null;
  if (kind !== "custom") return "Only a custom workstream can be renamed.";
  if (typeof label !== "string" || label.trim().length < 1 || label.trim().length > 60) return "A workstream name must be between 1 and 60 characters.";
  return null;
}

export function validateFrameArchive(kind: string, liveNodeCount: number): string | null {
  if (kind === "context") return null;
  if (kind !== "custom") return "Only a custom workstream can be removed.";
  if (liveNodeCount > 0) return "Move its cards first.";
  return null;
}

function validNodeGeometry(kind: WorkboardNodeDto["kind"], node: { x?: number; y?: number; w?: number; h?: number }): boolean {
  return validWorkboardNodeGeometry({ kind, ...node });
}

function nodePatchForDatabase(patch: Extract<WorkboardCommand, { type: "node_update" }>["patch"]): Record<string, unknown> {
  const { frameId, ...rest } = patch;
  return definedPatch({ ...rest, ...(frameId !== undefined ? { frame_id: frameId } : {}) });
}

export async function applyWorkboardCommand(
  db: Db,
  engagementId: string,
  profile: ResolvedProfile,
  command: WorkboardCommand,
): Promise<WorkboardMutationResult> {
  const membership = await membershipFor(db, engagementId, profile.id);
  if (!membership.isMember) return { status: "forbidden" };
  // Coaches read already-permitted sources. They never arrange the shared
  // workboard, so nothing they send may even lazy-create the board row.
  if (!membership.isEditor) return { status: "forbidden" };

  const board = await ensureBoard(db, engagementId, profile);
  if (!board) return { status: "forbidden" };

  const stamp = { updated_by: profile.id };


  if (command.type === "materialize") {
    if (!membership.isEditor) return { status: "forbidden" };
    if (command.frames.some((frame) => !validFrameGeometry(frame))) return { status: "validation_error", message: "Workstream dimensions are outside the supported range." };
    const existingFrames = (await db.from("workboard_frames").select("id, key").eq("workboard_id", board.id).is("deleted_at", null)).data ?? [];
    const frameIdByKey = new Map(existingFrames.map((row) => [row.key, row.id]));
    const missingFrames = command.frames.filter((frame) => !frameIdByKey.has(frame.key));
    if (missingFrames.length > 0) {
      const { data: inserted, error } = await db
        .from("workboard_frames")
        .insert(missingFrames.map((frame) => frameInsert(board.id, profile.id, frame)))
        .select("id, key");
      if (error) return { status: "validation_error", message: "The workboard frames could not be saved." };
      for (const row of inserted ?? []) frameIdByKey.set(row.key, row.id);
    }

    const existingNodes = (await db.from("workboard_nodes").select("id, kind, work_item_id, decision_id, client_key").eq("workboard_id", board.id).is("deleted_at", null)).data ?? [];
    const nodeIdByRef = new Map(existingNodes.map((row) => [refKey(row.kind, row.work_item_id, row.decision_id), row.id]));
    const nodeIdByClientKey = new Map(existingNodes.flatMap((row) => (row.client_key ? [[row.client_key, row.id] as const] : [])));
    const createdNodes: Record<string, string> = {};
    const createdFrames: Record<string, string> = Object.fromEntries(frameIdByKey);
    // Materialize is replayable: a card this board already carries, by client
    // key or by canonical reference, is reported back rather than made twice.
    const toInsert = command.nodes.filter((node) => {
      if (nodeIdByClientKey.has(node.clientKey)) {
        createdNodes[node.clientKey] = nodeIdByClientKey.get(node.clientKey) as string;
        return false;
      }
      if (node.kind === "judgment" || node.kind === "draft") return true;
      return !nodeIdByRef.has(refKey(node.kind, node.workItemId ?? null, node.decisionId ?? null));
    });
    for (const node of toInsert) {
      const invalid = validNodeInput(node);
      if (invalid) return { status: "validation_error", message: invalid };
      const saved = await insertNodeIdempotent(db, board.id, profile.id, node, node.frameKey ? frameIdByKey.get(node.frameKey) ?? null : null);
      if (!saved) return { status: "validation_error", message: "A workboard card could not be saved." };
      createdNodes[node.clientKey] = saved.id;
    }
    return { status: "saved", boardId: board.id, boardVersion: board.version, created: { nodes: createdNodes, frames: createdFrames }, versions: {} };

  }

  if (command.type === "frame_create") {
    if (!membership.isEditor) return { status: "forbidden" };
    if (!validFrameGeometry(command.frame)) return { status: "validation_error", message: "Workstream dimensions are outside the supported range." };
    const badFill = validateFrameFill(command.frame.fill ?? null);
    if (badFill) return { status: "validation_error", message: badFill };
    const { data, error } = await db
      .from("workboard_frames")
      .insert(frameInsert(board.id, profile.id, command.frame))
      .select("id, version")
      .single();
    if (error || !data) return { status: "validation_error", message: "The workstream could not be saved." };
    return { status: "saved", boardId: board.id, boardVersion: board.version, created: { frameId: data.id }, versions: { [data.id]: data.version } };
  }

  if (command.type === "frame_update" || command.type === "frame_archive" || command.type === "frame_restore") {
    if (!membership.isEditor) return { status: "forbidden" };
    if (command.type === "frame_update" && !validFrameGeometry(command.patch)) return { status: "validation_error", message: "Workstream dimensions are outside the supported range." };
    const targetQuery = db.from("workboard_frames").select("id, kind, key, fill").eq("id", command.frameId).eq("workboard_id", board.id);
    const target = (await (command.type === "frame_restore" ? targetQuery.not("deleted_at", "is", null) : targetQuery.is("deleted_at", null)).maybeSingle()).data;
    if (!target) return { status: "validation_error", message: "That workstream is gone." };
    const normalizedLabel = command.type === "frame_update" && typeof command.patch.label === "string" ? command.patch.label.trim() : command.type === "frame_update" ? command.patch.label : undefined;
    if (command.type === "frame_update" && command.patch.fill !== undefined) {
      const invalid = validateFrameFill(command.patch.fill);
      if (invalid) return { status: "validation_error", message: invalid };
    }
    if (command.type === "frame_update" && command.patch.label !== undefined) {
      const invalid = validateFrameLabel(target.kind, normalizedLabel, { region: isRegionFrameId((target as { key?: string }).key) });
      if (invalid) return { status: "validation_error", message: invalid };
    }
    if (command.type === "frame_archive") {
      const { count } = await db.from("workboard_nodes").select("id", { count: "exact", head: true }).eq("workboard_id", board.id).eq("frame_id", command.frameId).is("deleted_at", null);
      const invalid = validateFrameArchive(target.kind, count ?? 0);
      if (invalid) return { status: "validation_error", message: invalid };
    }
    const patch =
      command.type === "frame_update"
        ? { ...definedPatch({ ...command.patch, taskId: undefined, ...(command.patch.taskId !== undefined ? { task_id: command.patch.taskId } : {}), ...(normalizedLabel !== undefined ? { label: normalizedLabel || null } : {}) }), ...stamp }
        : command.type === "frame_restore"
          ? { deleted_at: null, ...definedPatch(command.patch ?? {}), ...stamp }
          : { deleted_at: new Date().toISOString(), ...stamp };
    const { data } = await db
      .from("workboard_frames")
      .update(patch)
      .eq("id", command.frameId)
      .eq("workboard_id", board.id)
      .eq("version", command.expectedVersion)
      .select("id, version, x, y, w, h, label, ord, deleted_at");
    const row = data?.[0];
    if (!row) {
      const latest = (await db.from("workboard_frames").select("*").eq("id", command.frameId).maybeSingle()).data;
      if (!latest) return { status: "validation_error", message: "That workstream is gone." };
      return conflict("frame", latest.id, snapshot(latest));
    }
    return { status: "saved", boardId: board.id, boardVersion: board.version, versions: { [row.id]: row.version } };
  }

  if (command.type === "node_create") {
    const invalid = validNodeInput(command.node);
    if (invalid) return { status: "validation_error", message: invalid };
    const frameId = command.node.frameKey ? await frameIdForKey(db, board.id, command.node.frameKey) : null;
    const saved = await insertNodeIdempotent(db, board.id, profile.id, command.node, frameId);
    if (!saved) return { status: "validation_error", message: "The card could not be saved." };
    return { status: "saved", boardId: board.id, boardVersion: board.version, created: { nodeId: saved.id }, versions: { [saved.id]: saved.version } };
  }

  if (command.type === "node_update" || command.type === "node_archive" || command.type === "node_restore") {
    // Authored judgment and draft cards answer only to their author, archive
    // and restore included. Canonical reference cards are shared structure.
    const owner = (await db.from("workboard_nodes").select("kind, author_profile_id").eq("id", command.nodeId).eq("workboard_id", board.id).maybeSingle()).data;
    if (owner && (owner.kind === "judgment" || owner.kind === "draft" || ((owner.kind === "text" || owner.kind === "sticky") && command.type === "node_update" && command.patch.body !== undefined)) && owner.author_profile_id !== profile.id) {
      return { status: "forbidden" };
    }
    if (!owner) return { status: "validation_error", message: "That card is gone." };
    if (command.type === "node_update") {
      const invalid = validNodeUpdate(owner.kind as WorkboardNodeDto["kind"], command.patch);
      if (invalid) return { status: "validation_error", message: invalid };
    }
    if (command.type === "node_update" && command.patch.frameId) {
      const target = (await db.from("workboard_frames").select("id").eq("id", command.patch.frameId).eq("workboard_id", board.id).is("deleted_at", null).maybeSingle()).data;
      if (!target) return { status: "validation_error", message: "That workstream is not on this workboard." };
    }
    const patch =
      command.type === "node_update"
        ? { ...nodePatchForDatabase(command.patch), ...stamp }
        : { deleted_at: command.type === "node_archive" ? new Date().toISOString() : null, ...stamp };
    const { data, error } = await db
      .from("workboard_nodes")
      .update(patch)

      .eq("id", command.nodeId)
      .eq("workboard_id", board.id)
      .eq("version", command.expectedVersion)
        .select("id, version, x, y, w, h, hidden, title, body, frame_id, deleted_at");
    if (error) return { status: "forbidden" };
    const row = data?.[0];
    if (!row) {
      const latest = (await db.from("workboard_nodes").select("*").eq("id", command.nodeId).maybeSingle()).data;
      if (!latest) return { status: "validation_error", message: "That card is gone." };
      return conflict("node", latest.id, snapshot(latest));
    }
    return { status: "saved", boardId: board.id, boardVersion: board.version, versions: { [row.id]: row.version } };
  }

  if (command.type === "link_create") {
    if (!membership.isEditor) return { status: "forbidden" };
    if (!WORKBOARD_ANCHORS.includes(command.fromAnchor) || !WORKBOARD_ANCHORS.includes(command.toAnchor)) {
      return { status: "validation_error", message: "Unknown anchor." };
    }
    if (command.relation !== undefined && !WORKBOARD_RELATIONS.includes(command.relation)) return { status: "validation_error", message: "Unknown relationship." };
    if (command.fromNodeId === command.toNodeId) return { status: "validation_error", message: "A card cannot connect to itself." };
    const endpoints = (await db.from("workboard_nodes").select("id, kind").eq("workboard_id", board.id).is("deleted_at", null).in("id", [command.fromNodeId, command.toNodeId])).data ?? [];
    if (endpoints.length !== 2) return { status: "validation_error", message: "One of those cards is not on this workboard." };
    const invalidKinds = validateLinkNodeKinds(endpoints.map((endpoint) => endpoint.kind));
    if (invalidKinds) return { status: "validation_error", message: invalidKinds };
    const { data, error } = await db
      .from("workboard_links")
      .insert({
        workboard_id: board.id,
        from_node_id: command.fromNodeId,
        to_node_id: command.toNodeId,
        from_anchor: command.fromAnchor,
        to_anchor: command.toAnchor,
        relation: command.relation ?? "context",
        author_profile_id: profile.id,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select("id, version")
      .single();
    if (error || !data) return { status: "validation_error", message: "These cards are already connected." };
    return { status: "saved", boardId: board.id, boardVersion: board.version, created: { linkId: data.id }, versions: { [data.id]: data.version } };
  }

  if (command.type === "link_update") {
    // What a link means is shared structure, so only an editor may change it.
    if (!membership.isEditor) return { status: "forbidden" };
    if (!WORKBOARD_RELATIONS.includes(command.relation)) return { status: "validation_error", message: "Unknown relationship." };
    const { data, error } = await db
      .from("workboard_links")
      .update({ relation: command.relation, ...stamp })
      .eq("id", command.linkId)
      .eq("workboard_id", board.id)
      .eq("version", command.expectedVersion)
      .select("id, version, relation");
    if (error) return { status: "forbidden" };
    const updated = data?.[0];
    if (!updated) {
      const latest = (await db.from("workboard_links").select("*").eq("id", command.linkId).maybeSingle()).data;
      if (!latest) return { status: "validation_error", message: "That relationship is gone." };
      return conflict("link", latest.id, snapshot(latest));
    }
    return { status: "saved", boardId: board.id, boardVersion: board.version, versions: { [updated.id]: updated.version } };
  }

  // link_archive
  if (!membership.isEditor) return { status: "forbidden" };
  const { data: linkData } = await db
    .from("workboard_links")
    .update({ deleted_at: new Date().toISOString(), ...stamp })
    .eq("id", command.linkId)
    .eq("workboard_id", board.id)
    .eq("version", command.expectedVersion)
    .select("id, version, deleted_at");
  const linkRow = linkData?.[0];
  if (!linkRow) {
    const latest = (await db.from("workboard_links").select("*").eq("id", command.linkId).maybeSingle()).data;
    if (!latest) return { status: "validation_error", message: "That relationship is gone." };
    return conflict("link", latest.id, snapshot(latest));
  }
  return { status: "saved", boardId: board.id, boardVersion: board.version, versions: { [linkRow.id]: linkRow.version } };
}

function refKey(kind: string, workItemId: string | null, decisionId: string | null): string {
  return `${kind}:${workItemId ?? ""}:${decisionId ?? ""}`;
}

function frameInsert(boardId: string, profileId: string, frame: WorkboardFrameInput) {
  return {
    workboard_id: boardId,
    key: frame.key,
    kind: frame.kind,
    task_id: frame.taskId ?? null,
    label: frame.label ?? null,
    fill: frame.fill ?? null,
    x: frame.x,
    y: frame.y,
    w: frame.w,
    h: frame.h,
    ord: frame.ord,
    created_by: profileId,
    updated_by: profileId,
  };
}

function nodeInsert(boardId: string, profileId: string, node: WorkboardNodeInput, frameId: string | null) {
  return {
    workboard_id: boardId,
    frame_id: frameId,
    kind: node.kind,
    work_item_id: node.workItemId ?? null,
    decision_id: node.decisionId ?? null,
    author_profile_id: profileId,
    title: node.title ?? "",
    body: node.body ?? "",
    judgment_type: node.judgmentType ?? null,
    x: node.x,
    y: node.y,
    w: node.w,
    h: node.h,
    hidden: node.hidden ?? false,
    created_by: profileId,
    updated_by: profileId,
    client_key: node.clientKey,
  };
}

/**
 * One card, once. The client key is unique per board, so a retry after a lost
 * response returns the row the first attempt already wrote instead of a twin.
 */
async function insertNodeIdempotent(
  db: Db,
  boardId: string,
  profileId: string,
  node: WorkboardNodeInput,
  frameId: string | null,
): Promise<{ id: string; version: number } | null> {
  const { data, error } = await db
    .from("workboard_nodes")
    .insert(nodeInsert(boardId, profileId, node, frameId))
    .select("id, version")
    .single();
  if (data) return { id: data.id, version: data.version };
  if (error?.code !== "23505") return null;
  const existing = (
    await db.from("workboard_nodes").select("id, version").eq("workboard_id", boardId).eq("client_key", node.clientKey).is("deleted_at", null).maybeSingle()
  ).data;
  return existing ? { id: existing.id, version: existing.version } : null;
}


/**
 * Slice 2a: a highlight hangs off the card for its work item, so the card has
 * to be durable. An existing card is reused exactly as it sits; nothing moves.
 */
export async function ensureWorkItemNode(
  db: Db,
  boardId: string,
  profileId: string,
  workItemId: string,
  /**
   * Where the card should land. Left out, it sits at the board origin, which
   * is what the highlight path has always done and still wants: that path only
   * needs the card to exist. Any path where a person will see the card should
   * pass a point chosen from free space.
   */
  position?: { x: number; y: number },
): Promise<string | null> {
  const { data } = await db
    .from("workboard_nodes")
    .select("id")
    .eq("workboard_id", boardId)
    .eq("work_item_id", workItemId)
    .is("deleted_at", null)
    .limit(1);
  const existing = (data ?? [])[0];
  if (existing) return existing.id;
  const created = await insertNodeIdempotent(
    db,
    boardId,
    profileId,
    {
      clientKey: `work:${workItemId}`,
      frameKey: null,
      kind: "work_item",
      workItemId,
      x: position?.x ?? 0,
      y: position?.y ?? 0,
      w: WORKBOARD_CARD_DEFAULT_SIZE.width,
      h: WORKBOARD_CARD_DEFAULT_SIZE.height,
    },
    null,
  );
  return created?.id ?? null;
}

async function frameIdForKey(db: Db, boardId: string, key: string): Promise<string | null> {
  const { data } = await db.from("workboard_frames").select("id").eq("workboard_id", boardId).eq("key", key).is("deleted_at", null).maybeSingle();
  return data?.id ?? null;
}

function definedPatch<T extends Record<string, unknown>>(patch: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}
