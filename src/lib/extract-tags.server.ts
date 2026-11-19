/**
 * The reads and the one write behind firm brain tags (Firm Brain Build Spec, step 5). The rules are in
 * extract-tags-shared.ts; this file only fetches what they need and stores what survived. Both functions are called
 * from the extractor with the admin client, and neither may fail an extract: the caller treats a throw as "no tags".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  mergeExtractedTags,
  sameStoredTags,
  situationCarrierId,
  situationRank,
  type CarrierCandidate,
  type ExtractedTags,
  type TagAsk,
  type TagContext,
} from "./extract-tags-shared";
import { isDeliverableType } from "./lineage-shared";

type Db = SupabaseClient<Database>;

/** How many names are read for the role check. A workspace with more people than this is far outside today's firms. */
const NAME_LIMIT = 2000;
const ID_PAGE = 100;
/** How much of the engagement's brief goes into the carrier's prompt. */
export const BRIEF_PROMPT_CHARS = 1500;

export type TagItem = {
  id: string;
  org_id: string;
  type: string;
  title: string;
  visibility?: string | null | undefined;
  work_date?: string | null | undefined;
  meta?: unknown;
};

/** Every board this item is placed on, in id order so the answer is the same on every run. Empty when it is unplaced. */
export async function boardsForItem(admin: Db, itemId: string): Promise<string[]> {
  const { data, error } = await admin.from("work_item_tasks").select("tasks(engagement_id)").eq("work_item_id", itemId).limit(200);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as { tasks: { engagement_id: string } | null }[];
  return [...new Set(rows.map((row) => row.tasks?.engagement_id).filter((id): id is string => typeof id === "string"))].sort();
}

/** The board an item's situation is worked out on: the first of its boards, or null when it is unplaced. */
export async function boardForItem(admin: Db, itemId: string): Promise<string | null> {
  return (await boardsForItem(admin, itemId))[0] ?? null;
}

/** Every item placed on one board, as the carrier rule reads them. */
export async function boardCarrierCandidates(admin: Db, engagementId: string, orgId: string): Promise<CarrierCandidate[]> {
  const { data: placed, error } = await admin.from("work_item_tasks").select("work_item_id, tasks!inner(engagement_id)").eq("tasks.engagement_id", engagementId);
  if (error) throw new Error(error.message);
  const ids = [...new Set((placed ?? []).map((row) => row.work_item_id))];
  const items: CarrierCandidate[] = [];
  for (let i = 0; i < ids.length; i += ID_PAGE) {
    const { data, error: readError } = await admin
      .from("work_items")
      .select("id, type, title, visibility, meta, work_date")
      .eq("org_id", orgId)
      .in("id", ids.slice(i, i + ID_PAGE));
    if (readError) throw new Error(readError.message);
    for (const row of data ?? []) items.push({ id: row.id, type: row.type, title: row.title, visibility: row.visibility, meta: row.meta, date: row.work_date });
  }
  return items;
}

/** Every person in the workspace and every client it has, for the "a role is never a name" check. */
async function knownNames(admin: Db, orgId: string): Promise<string[]> {
  const [people, clients] = await Promise.all([
    admin.from("profiles").select("display_name").eq("org_id", orgId).limit(NAME_LIMIT),
    admin.from("clients").select("name").eq("org_id", orgId).limit(NAME_LIMIT),
  ]);
  if (people.error) throw new Error(people.error.message);
  if (clients.error) throw new Error(clients.error.message);
  return [...(people.data ?? []).map((row) => row.display_name), ...(clients.data ?? []).map((row) => row.name)].filter(
    (name): name is string => typeof name === "string" && name.trim().length > 0,
  );
}

/**
 * What the extractor needs to ask for and check one item's tags. Reads only what the item's type calls for: names for
 * a call, a client mark for a deliverable, and the rest of the board only when this item could carry the situation.
 */
export async function loadTagContext(admin: Db, item: TagItem): Promise<{ context: TagContext; brief: string | null }> {
  const self: CarrierCandidate = {
    id: item.id,
    type: item.type,
    title: item.title,
    visibility: item.visibility ?? "",
    meta: item.meta ?? null,
    date: item.work_date ?? null,
  };
  let carrier = false;
  let brief: string | null = null;
  let shown = false;
  if (isDeliverableType(item.type)) {
    const { data, error } = await admin.from("client_showings").select("id").eq("work_item_id", item.id).limit(1);
    if (error) throw new Error(error.message);
    shown = (data ?? []).length > 0;
  }
  const rank = situationRank(self);
  // Rank 0 is a situation the lead set by hand: it already wins on read, so the model is not asked again.
  if (rank !== null && rank !== 0) {
    const engagementId = await boardForItem(admin, item.id);
    if (engagementId) {
      const others = await boardCarrierCandidates(admin, engagementId, item.org_id);
      carrier = situationCarrierId([self, ...others.filter((other) => other.id !== item.id)]) === item.id;
      if (carrier) {
        const { data, error } = await admin.from("engagements").select("brief").eq("id", engagementId).eq("org_id", item.org_id).maybeSingle();
        if (error) throw new Error(error.message);
        brief = data?.brief?.trim() ? data.brief.trim().slice(0, BRIEF_PROMPT_CHARS) : null;
      }
    }
  }
  const names = item.type === "call" ? await knownNames(admin, item.org_id) : [];
  return { context: { type: item.type, carrier, shown, names }, brief };
}

/**
 * Stores the tags on the item's own meta, under the keys the demo seed uses. The meta is read again just before the
 * write, so a lead's correction or fee terms saved while the model was thinking are kept. Returns false when the
 * write did not land (zero rows back is a refusal).
 */
export async function storeItemTags(admin: Db, item: Pick<TagItem, "id" | "org_id">, tags: ExtractedTags, ask: TagAsk): Promise<boolean> {
  const { data: row, error } = await admin.from("work_items").select("meta").eq("id", item.id).eq("org_id", item.org_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) return false;
  const next = mergeExtractedTags(row.meta, tags, ask);
  if (sameStoredTags(row.meta, next)) return true;
  const { data: written, error: writeError } = await admin
    .from("work_items")
    .update({ meta: next as never })
    .eq("id", item.id)
    .eq("org_id", item.org_id)
    .select("id");
  if (writeError) throw new Error(writeError.message);
  return (written ?? []).length > 0;
}
