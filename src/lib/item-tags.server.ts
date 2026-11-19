/**
 * A board lead's correction to an item's firm brain tags (Firm Brain Build Spec, step 5). The gate lives here, on the
 * server: the board's lead (its owner) or a workspace admin, on an item in their own workspace that sits on a board.
 * The admin client reads and writes behind it, as fee terms do, because a lead corrects work someone else captured.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { boardCarrierCandidates, boardsForItem } from "./extract-tags.server";
import {
  buildTagCorrection,
  canCorrectTags,
  canHoldSituation,
  ITEM_TAGS_COPY,
  itemTagsView,
  tagFieldsFor,
  withTagCorrection,
  type CarrierCandidate,
  type ItemTagsView,
  type TagCorrectionInput,
} from "./extract-tags-shared";

type Db = SupabaseClient<Database>;

export type TagCaller = { id: string; org_id: string; role: string };

type GatedItem = { id: string; type: string; meta: unknown; holdsSituation: boolean };

/**
 * Everything checked before a tag is read or written. Throws a Response the dialog turns into its plain line. A
 * private item is refused unless it is the caller's own: a lead cannot open it, so a lead cannot read its tags either.
 */
async function gate(admin: Db, caller: TagCaller, itemId: string): Promise<GatedItem> {
  const { data: item, error } = await admin
    .from("work_items")
    .select("id, org_id, owner_id, type, title, visibility, meta, work_date")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw new Response("Could not load.", { status: 500 });
  if (!item || item.org_id !== caller.org_id) throw new Response("Not found", { status: 404 });
  if (item.visibility !== "mapped" && item.owner_id !== caller.id) throw new Response("Not found", { status: 404 });
  const boardIds = await boardsForItem(admin, itemId);
  if (!boardIds.length) throw new Response(ITEM_TAGS_COPY.notOnBoard, { status: 400 });
  const { data: boards, error: boardError } = await admin.from("engagements").select("id, org_id, owner_id").in("id", boardIds);
  if (boardError) throw new Response("Could not load.", { status: 500 });
  const mine = (boards ?? []).filter((board) => board.org_id === caller.org_id).sort((a, b) => a.id.localeCompare(b.id));
  if (!mine.length) throw new Response("Not found", { status: 404 });
  // An item can sit on several boards: a lead corrects it through a board they lead, an admin through any of them.
  const board = mine.find((candidate) => candidate.owner_id === caller.id) ?? mine[0]!;
  if (!canCorrectTags({ role: caller.role, isBoardLead: board.owner_id === caller.id })) throw new Response("Forbidden", { status: 403 });
  const self: CarrierCandidate = { id: item.id, type: item.type, title: item.title, visibility: item.visibility, meta: item.meta, date: item.work_date };
  const others = await boardCarrierCandidates(admin, board.id, caller.org_id);
  return { id: item.id, type: item.type, meta: item.meta, holdsSituation: canHoldSituation(self, [self, ...others.filter((other) => other.id !== item.id)]) };
}

/** The item's tags as the firm reads them now, for the board's lead and admins only. */
export async function readItemTags(admin: Db, caller: TagCaller, itemId: string): Promise<ItemTagsView> {
  const item = await gate(admin, caller, itemId);
  return itemTagsView(item, item.holdsSituation);
}

/**
 * Saves the lead's correction, or removes it so the item reads as Charlotte tagged it. The meta is read inside the
 * gate just before the write. Zero rows back means the write was refused, and is reported as one.
 */
export async function saveItemTags(admin: Db, caller: TagCaller, itemId: string, input: TagCorrectionInput & { clear?: boolean }): Promise<ItemTagsView> {
  const item = await gate(admin, caller, itemId);
  let meta: Record<string, unknown>;
  if (input.clear === true) {
    meta = withTagCorrection(item.meta, null);
  } else {
    const built = buildTagCorrection(input, tagFieldsFor(item, item.holdsSituation), caller.id);
    if (!built.ok) throw new Response(built.problem, { status: 400 });
    meta = withTagCorrection(item.meta, built.correction);
  }
  const { data: written, error } = await admin
    .from("work_items")
    .update({ meta: meta as never })
    .eq("id", item.id)
    .eq("org_id", caller.org_id)
    .select("id");
  if (error || (written ?? []).length === 0) throw new Response("Could not save.", { status: 500 });
  return itemTagsView({ type: item.type, meta }, item.holdsSituation);
}
