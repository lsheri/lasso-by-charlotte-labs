/**
 * S1: the one elevated path in the share feature, deliberately narrow.
 *
 * The viewer has no session, so this runs with elevated rights. Because of
 * that it is narrow by construction:
 *   - it takes a token and nothing else, and it never returns a board id, an
 *     org id, a person, an owner, or the link row itself;
 *   - it reads exactly one board and the records already drawn on it;
 *   - the only write it can make is bumping opened_count and last_opened_at
 *     on the link row that was just presented;
 *   - a wrong token, an expired one and a revoked one all return the same
 *     closed answer, so the response cannot be read to learn what exists.
 *
 * Nothing else in the product may call into this module.
 */

import type { Database } from "@/integrations/supabase/types";

import {
  looksLikeShareToken,
  type SharedBoardDecision,
  type SharedBoardDto,
  type SharedBoardItem,
  type SharedBoardResult,
  type SharedBoardTurn,
} from "./board-share-shared";
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
    .select("id, workboard_id, org_id, expires_at, revoked_at, opened_count")
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

  const board = await readBoard(supabaseAdmin, link.workboard_id, link.expires_at);
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

async function readBoard(
  db: AdminDb,
  workboardId: string,
  expiresAt: string,
): Promise<SharedBoardDto | null> {
  const { data: boardRow } = await db
    .from("workboards")
    .select("id")
    .eq("id", workboardId)
    .maybeSingle();
  if (!boardRow) return null;

  const [framesRes, nodesRes, linksRes] = await Promise.all([
    db
      .from("workboard_frames")
      .select("id, kind, label, x, y, w, h, ord")
      .eq("workboard_id", workboardId)
      .is("deleted_at", null)
      .order("ord"),
    db
      .from("workboard_nodes")
      .select("id, frame_id, kind, title, body, judgment_type, x, y, w, h, work_item_id, decision_id, hidden")
      .eq("workboard_id", workboardId)
      .is("deleted_at", null),
    db
      .from("workboard_links")
      .select("id, from_node_id, to_node_id, relation")
      .eq("workboard_id", workboardId)
      .is("deleted_at", null),
  ]);

  const frames = (framesRes.data ?? []).map((row) => ({
    id: row.id,
    kind: row.kind,
    label: row.label,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    ord: row.ord,
  }));
  // A card hidden on the board is not on the board, so it does not travel.
  const nodeRows = (nodesRes.data ?? []).filter((row) => !row.hidden);
  const nodes = nodeRows.map((row) => ({
    id: row.id,
    frameId: row.frame_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    judgmentType: row.judgment_type,
    x: row.x,
    y: row.y,
    w: row.w,
    h: row.h,
    workItemId: row.work_item_id,
    decisionId: row.decision_id,
  }));
  const visible = new Set(nodes.map((node) => node.id));
  const links = (linksRes.data ?? [])
    .filter((row) => visible.has(row.from_node_id) && visible.has(row.to_node_id))
    .map((row) => ({
      id: row.id,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      relation: row.relation,
    }));

  const workIds = [...new Set(nodes.map((node) => node.workItemId).filter((id): id is string => !!id))];
  const decisionIds = [
    ...new Set(nodes.map((node) => node.decisionId).filter((id): id is string => !!id)),
  ];

  const [itemsRes, turnsRes, decisionsRes] = await Promise.all([
    workIds.length > 0
      ? db.from("work_items").select("id, title, type").in("id", workIds)
      : Promise.resolve({ data: [] as { id: string; title: string; type: string }[] }),
    workIds.length > 0
      ? db
          .from("turns")
          .select("work_item_id, turn_no, role, content")
          .in("work_item_id", workIds)
          .order("turn_no", { ascending: true })
          .limit(TURN_LIMIT)
      : Promise.resolve({ data: [] as { work_item_id: string; turn_no: number; role: string; content: string }[] }),
    decisionIds.length > 0
      ? db.from("decisions").select("id, call_text, situation, why").in("id", decisionIds)
      : Promise.resolve({ data: [] as { id: string; call_text: string; situation: string; why: string }[] }),
  ]);

  const turnsByItem = new Map<string, SharedBoardTurn[]>();
  for (const row of turnsRes.data ?? []) {
    const list = turnsByItem.get(row.work_item_id) ?? [];
    list.push({ turnNo: row.turn_no, role: row.role, content: row.content });
    turnsByItem.set(row.work_item_id, list);
  }

  const items: SharedBoardItem[] = (itemsRes.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    turns: turnsByItem.get(row.id) ?? [],
  }));
  const decisions: SharedBoardDecision[] = (decisionsRes.data ?? []).map((row) => ({
    id: row.id,
    call: row.call_text,
    situation: row.situation,
    why: row.why,
  }));

  return { frames, nodes, links, items, decisions, expiresAt };
}
