/**
 * S1: the one elevated path in the share feature, deliberately narrow.
 *
 * The viewer has no session, so this runs with elevated rights. Because of
 * that it is narrow by construction:
 *   - it takes a token and nothing else, and it never returns a board id, an
 *     org id, a person, an owner, or the link row itself;
 *   - it reads exactly one board and the records the live board draws from;
 *   - the only write it can make is bumping opened_count and last_opened_at
 *     on the link row that was just presented;
 *   - a wrong token, an expired one and a revoked one all return the same
 *     closed answer, so the response cannot be read to learn what exists.
 *
 * Nothing else in the product may call into this module, except the public
 * demo (demo-board.server.ts), which reuses readBoard with a null viewer.
 */

import type { Database } from "@/integrations/supabase/types";

import type { WorkboardFrameDto, WorkboardLinkDto, WorkboardNodeDto } from "./canvas-lab-shared";
import {
  looksLikeShareToken,
  type SharedBoardDto,
  type SharedBoardResult,
  type SharedBoardTurn,
  type SharedSeedWork,
  type SharedWorkboard,
} from "./board-share-shared";
import { isBoardDefaultTask } from "./board-default-task";
import type { WorkItemRow } from "./work-types";
import type { WorkboardFilePreview } from "./workboard-card-preview.shared";
import { readWorkboardCardPreviews } from "./workboard-card-preview.server";
import {
  artifactPreviewKind,
  fallbackFilePreview,
  filePreviewKind,
  slidesFromMap,
  wrapSvgArtifact,
} from "./workboard-file-preview";
import { sha256Hex } from "./telemetry.server";

type Refusal = "expired" | "revoked" | "unknown";

const TURN_LIMIT = 4000;

async function noteShareEvent(
  action: "opened" | "refused",
  orgId: string | null,
  reason?: Refusal,
): Promise<void> {
  const dims = reason ? { action, reason } : { action };
  try {
    if (orgId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin, {
        eventType: "board.share_link",
        orgId,
        userId: null,
        dims,
      });
      return;
    }
    const { recordAnonymousEvent } = await import("./telemetry.server");
    await recordAnonymousEvent("board.share_link", crypto.randomUUID(), dims);
  } catch {
    /* coverage never surfaces to whoever opened the link */
  }
}

/** Takes a token, returns one board or nothing. No other shape exists. */
export async function openSharedBoard(token: string): Promise<SharedBoardResult> {
  if (!looksLikeShareToken(token)) {
    await noteShareEvent("refused", null, "unknown");
    return { status: "closed" };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tokenHash = await sha256Hex(token);

  const { data: link } = await supabaseAdmin
    .from("board_share_links")
    .select("id, workboard_id, org_id, created_by, expires_at, revoked_at, opened_count")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!link) {
    await noteShareEvent("refused", null, "unknown");
    return { status: "closed" };
  }
  if (link.revoked_at) {
    await noteShareEvent("refused", link.org_id, "revoked");
    return { status: "closed" };
  }
  if (new Date(link.expires_at).getTime() <= Date.now()) {
    await noteShareEvent("refused", link.org_id, "expired");
    return { status: "closed" };
  }

  const board = await readBoard(supabaseAdmin, link.workboard_id, link, link.created_by);
  if (!board) {
    await noteShareEvent("refused", link.org_id, "unknown");
    return { status: "closed" };
  }

  await supabaseAdmin
    .from("board_share_links")
    .update({ opened_count: link.opened_count + 1, last_opened_at: new Date().toISOString() })
    .eq("id", link.id);
  await noteShareEvent("opened", link.org_id);

  return { status: "open", board };
}

type AdminDb = Awaited<
  typeof import("@/integrations/supabase/client.server")
>["supabaseAdmin"];

type FrameRow = Database["public"]["Tables"]["workboard_frames"]["Row"];
type NodeRow = Database["public"]["Tables"]["workboard_nodes"]["Row"];
type LinkRow = Database["public"]["Tables"]["workboard_links"]["Row"];

const WORK_SELECT =
  "id, owner_id, orig_conversation_id, ungrouped_at, title, type, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, source_meta, meta, work_item_extracts(summary)";
const TASKS_SELECT = `id, name, detail, is_wrap, is_board_default, work_item_tasks(work_items(${WORK_SELECT}))`;
const FILE_PREVIEW_LIMIT = 40;
const MAX_ARTIFACT_BYTES = 1024 * 1024;

type TaskRow = {
  id: string;
  name: string;
  detail: string | null;
  is_wrap?: boolean | null;
  is_board_default?: boolean | null;
  work_item_tasks: { work_items: (WorkItemRow & { owner_id?: string | null }) | null }[] | null;
};

/**
 * The same inputs the live board page feeds its model, read for one board.
 *
 * What travels is what the person who made the link could see on the board:
 * work the engagement can read (mapped) or that is theirs, decisions that are
 * confirmed or that are their own drafts. Anything hidden on the board is not
 * on the board, so it travels nowhere, including its seed record.
 */
export async function readBoard(
  db: AdminDb,
  workboardId: string,
  link: { expires_at: string; org_id: string },
  viewerProfileId: string | null = null,
): Promise<SharedBoardDto | null> {
  const { data: boardRow } = await db
    .from("workboards")
    .select("id, engagement_id, version")
    .eq("id", workboardId)
    .maybeSingle();
  if (!boardRow) return null;

  const [engagementRes, framesRes, nodesRes, linksRes, tasksRes, decisionsRes] = await Promise.all([
    db.from("engagements").select("id, org_id, brief").eq("id", boardRow.engagement_id).maybeSingle(),
    db.from("workboard_frames").select("*").eq("workboard_id", workboardId).is("deleted_at", null).order("ord"),
    db.from("workboard_nodes").select("*").eq("workboard_id", workboardId).is("deleted_at", null),
    db.from("workboard_links").select("*").eq("workboard_id", workboardId).is("deleted_at", null),
    db
      .from("tasks")
      .select(TASKS_SELECT)
      .eq("engagement_id", boardRow.engagement_id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    db
      .from("decisions")
      .select("id, call_text, situation, status, owner_id")
      .eq("engagement_id", boardRow.engagement_id)
      .in("status", ["draft", "confirmed"])
      .order("created_at", { ascending: true }),
  ]);
  const engagement = engagementRes.data;
  if (!engagement || engagement.org_id !== link.org_id) return null;

  const allNodeRows = (nodesRes.data ?? []) as NodeRow[];
  const hiddenRows = allNodeRows.filter((row) => row.hidden);
  const hiddenWork = new Set(hiddenRows.map((row) => row.work_item_id).filter((id): id is string => !!id));
  const hiddenDecisions = new Set(hiddenRows.map((row) => row.decision_id).filter((id): id is string => !!id));
  const briefHidden = hiddenRows.some((row) => row.kind === "brief");

  const readable = (item: { visibility: string; owner_id?: string | null }) =>
    item.visibility === "mapped" || (viewerProfileId !== null && item.owner_id === viewerProfileId);

  const taskRows = ((tasksRes.data ?? []) as unknown as TaskRow[]).filter((task) => !isBoardDefaultTask(task));
  const allTaskRows = (tasksRes.data ?? []) as unknown as TaskRow[];
  const workById = new Map<string, SharedSeedWork>();
  for (const task of allTaskRows) {
    for (const entry of task.work_item_tasks ?? []) {
      const item = entry.work_items;
      if (!item || hiddenWork.has(item.id) || !readable(item)) continue;
      const existing = workById.get(item.id);
      if (existing) {
        existing.taskIds.push(task.id);
        continue;
      }
      // No person travels: the owner is dropped, and so is the client claim.
      const { owner_id: _owner, client_id: _client, ...rest } = item as WorkItemRow;
      workById.set(item.id, { ...rest, taskIds: [task.id] });
    }
  }
  const work = [...workById.values()];

  const decisions = ((decisionsRes.data ?? []) as { id: string; call_text: string; situation: string; status: string; owner_id: string | null }[])
    .filter((row) => !hiddenDecisions.has(row.id))
    .filter((row) => row.status === "confirmed" || (viewerProfileId !== null && row.owner_id === viewerProfileId))
    .map((row) => ({ id: row.id, call: row.call_text, situation: row.situation }));
  const decisionIds = new Set(decisions.map((row) => row.id));

  const nodeRows = allNodeRows.filter((row) => {
    if (row.hidden) return false;
    if (row.work_item_id) return workById.has(row.work_item_id);
    if (row.decision_id) return decisionIds.has(row.decision_id);
    return true;
  });
  const frameRows = (framesRes.data ?? []) as FrameRow[];
  const frameIds = new Set(frameRows.map((row) => row.id));
  const visibleIds = new Set(nodeRows.map((row) => row.id));

  // An opaque index, fresh per response: ownership reads as "teammate" and no
  // profile id leaves the server.
  const authorIndex = new Map<string, string>();
  const authorOf = (id: string) => {
    let opaque = authorIndex.get(id);
    if (!opaque) {
      opaque = `author-${authorIndex.size + 1}`;
      authorIndex.set(id, opaque);
    }
    return opaque;
  };

  const board: SharedWorkboard = {
    id: "shared",
    engagementId: "",
    version: boardRow.version,
    frames: frameRows.map((row) => ({
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
    })),
    nodes: nodeRows.map((row): WorkboardNodeDto => ({
      id: row.id,
      frameId: row.frame_id && frameIds.has(row.frame_id) ? row.frame_id : null,
      kind: row.kind as WorkboardNodeDto["kind"],
      workItemId: row.work_item_id,
      decisionId: row.decision_id,
      authorProfileId: authorOf(row.author_profile_id),
      authorName: "A teammate",
      title: row.title,
      body: row.body,
      judgmentType: (row.judgment_type as WorkboardNodeDto["judgmentType"]) ?? null,
      x: row.x,
      y: row.y,
      w: row.w,
      h: row.h,
      hidden: false,
      version: row.version,
      referenceReadable: true,
      createdAt: row.created_at ?? null,
      linkedItemRemovedAt: row.linked_item_removed_at ?? null,
    })),
    links: ((linksRes.data ?? []) as LinkRow[])
      .filter((row) => visibleIds.has(row.from_node_id) && visibleIds.has(row.to_node_id))
      .map((row): WorkboardLinkDto => ({
        id: row.id,
        fromNodeId: row.from_node_id,
        toNodeId: row.to_node_id,
        fromAnchor: row.from_anchor as WorkboardLinkDto["fromAnchor"],
        toAnchor: row.to_anchor as WorkboardLinkDto["toAnchor"],
        relation: row.relation as WorkboardLinkDto["relation"],
        authorProfileId: authorOf(row.author_profile_id),
        version: row.version,
      })),
    viewerProfileId: null,
    canEditStructure: false,
    archivedContextFrame: null,
  };

  const chatIds = work.filter((item) => item.type === "ai_thread").map((item) => item.id);
  const [cardPreviewRows, turnsRes, filePreviews] = await Promise.all([
    chatIds.length > 0 ? readWorkboardCardPreviews(db, chatIds).catch(() => []) : Promise.resolve([]),
    chatIds.length > 0
      ? db
          .from("turns")
          .select("id, work_item_id, turn_no, role, content, ts, model")
          .in("work_item_id", chatIds)
          .order("turn_no", { ascending: true })
          .limit(TURN_LIMIT)
      : Promise.resolve({ data: [] as (SharedBoardTurn & { work_item_id: string })[] }),
    readFilePreviews(db, work.filter((item) => item.type !== "ai_thread").slice(0, FILE_PREVIEW_LIMIT)),
  ]);

  const turns: Record<string, SharedBoardTurn[]> = {};
  for (const row of (turnsRes.data ?? []) as (SharedBoardTurn & { work_item_id: string })[]) {
    (turns[row.work_item_id] ??= []).push({
      id: row.id,
      turn_no: row.turn_no,
      role: row.role,
      content: row.content,
      ts: row.ts,
      model: row.model,
    });
  }

  return {
    board,
    seed: {
      brief: briefHidden ? null : { text: engagement.brief },
      tasks: taskRows.map((task) => ({ id: task.id, name: task.name, detail: task.detail })),
      work,
      decisions,
    },
    cardPreviews: Object.fromEntries(cardPreviewRows.map((row) => [row.workItemId, row])),
    filePreviews,
    turns,
    expiresAt: link.expires_at,
  };
}

/** The live board's document and artifact previews, read without writing. */
async function readFilePreviews(db: AdminDb, items: SharedSeedWork[]): Promise<Record<string, WorkboardFilePreview>> {
  const entries = await Promise.all(items.map(async (item): Promise<[string, WorkboardFilePreview]> => {
    try {
      const { data: versions } = await db
        .from("document_versions")
        .select("slide_map, version_no")
        .eq("work_item_id", item.id)
        .order("version_no", { ascending: false });
      const versionCount = versions?.length ?? 0;
      const artifactKind = artifactPreviewKind(item);
      if (artifactKind && item.content_ref) {
        const stored = await db.storage.from("work-files").download(item.content_ref);
        if (!stored.error && stored.data && stored.data.size <= MAX_ARTIFACT_BYTES) {
          const text = await stored.data.text();
          const html = artifactKind === "svg" ? wrapSvgArtifact(text) : text;
          return [item.id, { workItemId: item.id, kind: artifactKind === "mermaid" ? "mermaid" : "html", url: null, html, lines: [], slideTitle: null, versionCount }];
        }
      }
      const pages = item.type === "deck" ? slidesFromMap(versions?.[0]?.slide_map ?? null) : [];
      const slide = pages[0] ?? null;
      if (slide) {
        return [item.id, { workItemId: item.id, kind: "slide", url: null, lines: slide.lines, slideTitle: slide.title, pages, versionCount }];
      }
      if (filePreviewKind(item) === "pdf" && item.content_ref) {
        const signed = await db.storage.from("work-files").createSignedUrl(item.content_ref, 600);
        if (!signed.error && signed.data?.signedUrl) {
          return [item.id, { workItemId: item.id, kind: "pdf", url: signed.data.signedUrl, lines: [], slideTitle: null, versionCount }];
        }
      }
      return [item.id, fallbackFilePreview(item, versionCount)];
    } catch {
      return [item.id, fallbackFilePreview(item)];
    }
  }));
  return Object.fromEntries(entries);
}

