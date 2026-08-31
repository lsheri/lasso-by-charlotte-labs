/**
 * Pass 111: the firm archive. shipped_work carries no client write policies by
 * design, so every write is made with the admin client only after the caller
 * has been shown, through their own reads, to own the work they are shipping.
 * Reads are plain caller-RLS: the archive is whatever the viewer may see.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { ShippedCard } from "@/lib/shipped-work-shared";
import { ownsWorkItem } from "@/lib/work-ownership";

export type CallerClient = SupabaseClient<Database>;

export const SHIP_NOT_AVAILABLE = "That work is not available to you.";
export const SHIP_NOT_DELIVERABLE = "Only a finished deliverable can be shipped to the firm.";
export const SHIP_CARD_NOT_FOUND = "That card is not in the archive.";

type ItemRow = { id: string; owner_id: string; org_id: string; type: string };

async function readItem(caller: CallerClient, workItemId: string): Promise<ItemRow> {
  const { data, error } = await caller
    .from("work_items")
    .select("id, owner_id, org_id, type")
    .eq("id", workItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(SHIP_NOT_AVAILABLE);
  return data as unknown as ItemRow;
}

export type ShippedRow = {
  id: string;
  org_id: string;
  work_item_id: string;
  engagement_id: string | null;
  shipped_by: string;
  shipped_at: string;
};

/** Owner-initiated, deliverables only, and a re-ship replaces the card. */
export async function shipWorkRow(
  caller: CallerClient,
  admin: CallerClient,
  input: {
    workItemId: string;
    engagementId: string | null;
    profile: { id: string; role: string };
  },
): Promise<ShippedRow> {
  const item = await readItem(caller, input.workItemId);
  if (!ownsWorkItem(input.profile, item)) throw new Response("Forbidden", { status: 403 });
  if (!isDeliverableType(item.type)) throw new Error(SHIP_NOT_DELIVERABLE);

  const { data, error } = await admin
    .from("shipped_work")
    .upsert(
      {
        org_id: item.org_id,
        work_item_id: item.id,
        engagement_id: input.engagementId,
        shipped_by: input.profile.id,
        shipped_at: new Date().toISOString(),
      },
      { onConflict: "org_id,work_item_id" },
    )
    .select("id, org_id, work_item_id, engagement_id, shipped_by, shipped_at")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as ShippedRow;
}

/** The shipper or the owner may take a card back. Exactly one row goes. */
export async function unshipWorkRow(
  caller: CallerClient,
  admin: CallerClient,
  input: { workItemId: string; profile: { id: string; role: string } },
): Promise<{ deleted: number; work_item_id: string }> {
  const { data, error } = await caller
    .from("shipped_work")
    .select("id, work_item_id, shipped_by")
    .eq("work_item_id", input.workItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const row = data as { id: string; work_item_id: string; shipped_by: string } | null;
  if (!row) throw new Error(SHIP_CARD_NOT_FOUND);

  const item = await readItem(caller, input.workItemId).catch(() => null);
  const isOwner = item ? ownsWorkItem(input.profile, item) : false;
  const isShipper = row.shipped_by === input.profile.id && input.profile.role !== "coach";
  if (!isOwner && !isShipper) throw new Response("Forbidden", { status: 403 });

  const removed = await admin
    .from("shipped_work")
    .delete()
    .eq("id", row.id)
    .select("id");
  if (removed.error) throw new Error(removed.error.message);
  return { deleted: (removed.data ?? []).length, work_item_id: row.work_item_id };
}

type JoinRow = {
  id: string;
  work_item_id: string;
  engagement_id: string | null;
  shipped_at: string;
  shipped_by: string;
  work_items: {
    title: string;
    type: string;
    source: string | null;
    source_vendor: string | null;
    source_meta: { mime?: string } | null;
    meta: {
      mime_type?: string | null;
      source_mime?: string | null;
      web_view_link?: string | null;
      deliverable_kind?: string | null;
    } | null;
    owner_id: string | null;
    work_date: string | null;
    created_at_source: string | null;
  } | null;
  profiles: { display_name: string } | null;
  engagements: {
    code: string | null;
    client_label: string | null;
    title: string | null;
    brief: string | null;
  } | null;
};

/**
 * Counts about the work only: how much of the record sits behind the card, and
 * how many facts were traced back into it. Both are read under the viewer's own
 * access, so a colleague outside the engagement simply sees fewer of them.
 */
async function countsFor(
  caller: CallerClient,
  itemIds: string[],
  engagementIds: string[],
): Promise<{ facts: Record<string, number>; items: Record<string, number> }> {
  const facts: Record<string, number> = {};
  const items: Record<string, number> = {};
  if (itemIds.length > 0) {
    const { data } = await caller
      .from("span_links")
      .select("from_item_id")
      .in("from_item_id", itemIds);
    for (const row of (data ?? []) as { from_item_id: string }[]) {
      facts[row.from_item_id] = (facts[row.from_item_id] ?? 0) + 1;
    }
  }
  if (engagementIds.length > 0) {
    const { data } = await caller
      .from("work_item_tasks")
      .select("work_item_id, tasks!inner(engagement_id)")
      .in("tasks.engagement_id", engagementIds);
    const seen = new Map<string, Set<string>>();
    for (const row of (data ?? []) as unknown as {
      work_item_id: string;
      tasks: { engagement_id: string } | null;
    }[]) {
      const eng = row.tasks?.engagement_id;
      if (!eng) continue;
      const set = seen.get(eng) ?? new Set<string>();
      set.add(row.work_item_id);
      seen.set(eng, set);
    }
    for (const [eng, set] of seen) items[eng] = set.size;
  }
  return { facts, items };
}

/** The archive as this viewer may see it, newest first. */
export async function listShippedCards(caller: CallerClient): Promise<ShippedCard[]> {
  const { data, error } = await caller
    .from("shipped_work")
    .select(
      "id, work_item_id, engagement_id, shipped_at, shipped_by, work_items(title, type, source, source_vendor, source_meta, meta, owner_id, work_date, created_at_source), profiles:shipped_by(display_name), engagements(code, client_label, title, brief)",
    )
    .order("shipped_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as JoinRow[];
  const present = rows.filter((row) => row.work_items);

  const itemIds = present.map((row) => row.work_item_id);
  const engagementIds = [
    ...new Set(present.map((row) => row.engagement_id).filter(Boolean) as string[]),
  ];
  const empty: { facts: Record<string, number>; items: Record<string, number> } = {
    facts: {},
    items: {},
  };
  const counts = await countsFor(caller, itemIds, engagementIds).catch(() => empty);

  return present.map((row) => ({
    id: row.id,
    work_item_id: row.work_item_id,
    engagement_id: row.engagement_id,
    shipped_at: row.shipped_at,
    shipped_by: row.shipped_by,
    shipped_by_name: row.profiles?.display_name ?? null,
    title: row.work_items?.title ?? "",
    type: row.work_items?.type ?? "document",
    source: row.work_items?.source ?? null,
    source_vendor: row.work_items?.source_vendor ?? null,
    source_meta: row.work_items?.source_meta ?? null,
    meta: row.work_items?.meta ?? null,
    owner_id: row.work_items?.owner_id ?? null,
    work_date: row.work_items?.work_date ?? null,
    created_at_source: row.work_items?.created_at_source ?? null,
    engagement_code: row.engagements?.code ?? null,
    client_label: row.engagements?.client_label ?? null,
    engagement_title: row.engagements?.title ?? null,
    engagement_brief: row.engagements?.brief ?? null,
    record_items: row.engagement_id ? (counts.items[row.engagement_id] ?? 0) : 0,
    traced_facts: counts.facts[row.work_item_id] ?? 0,
  }));
}
