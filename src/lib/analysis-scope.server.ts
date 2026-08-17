import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { deliverableKindOf, type DeliverableKind } from "@/lib/deliverable-kinds";
import { RELATION_LABEL, type LineageRelation } from "@/lib/lineage-shared";
import type { ContextScope } from "@/lib/reflect-shared";

type Db = SupabaseClient<Database>;

export type AnalysisTarget = {
  ownerId: string;
  title: string;
  scopeId: string;
  scopeType: "item" | "deliverable" | "engagement";
  scope: ContextScope;
  /** Mapped items in scope, used only to decide whether a preset may run. */
  itemsInScope: number;
  /** The owner's own label for what kind of deliverable this is, when set. */
  deliverableKind?: DeliverableKind | null;
};

/**
 * Deliverable scope: the deliverable itself plus the conversations and
 * documents already linked to it. The brief is added by the assembler as tier 0,
 * so it is never listed here and never budgeted away.
 */
export async function deliverableScopeIds(supabase: Db, deliverableId: string): Promise<string[]> {
  const { data } = await supabase
    .from("work_item_links")
    .select("from_item_id, status")
    .eq("to_item_id", deliverableId);
  const linked = (data ?? [])
    .filter((row) => row.status !== "discarded")
    .map((row) => row.from_item_id);
  return Array.from(new Set([deliverableId, ...linked]));
}

/** Every item mapped into one engagement for one owner. */
export async function engagementItemIds(
  supabase: Db,
  ownerId: string,
  engagementId: string,
): Promise<string[]> {
  const { data: tasks } = await supabase
    .from("tasks")
    .select("id")
    .eq("engagement_id", engagementId)
    .eq("owner_id", ownerId);
  const taskIds = (tasks ?? []).map((task) => task.id);
  if (taskIds.length === 0) return [];
  const { data: links } = await supabase
    .from("work_item_tasks")
    .select("work_item_id")
    .in("task_id", taskIds);
  return Array.from(new Set((links ?? []).map((row) => row.work_item_id)));
}

/**
 * What a run is pointed at, whatever its scope. Thread and deliverable runs
 * name a work item; engagement runs name an engagement.
 */
export async function resolveAnalysisTarget(
  supabase: Db,
  args: {
    scope: "thread" | "deliverable" | "engagement";
    profileId: string;
    workItemId?: string | null;
    engagementId?: string | null;
  },
): Promise<AnalysisTarget> {
  if (args.scope === "engagement") {
    if (!args.engagementId) throw new Error("Nothing to analyse.");
    const { data: engagement } = await supabase
      .from("engagements")
      .select("id, title")
      .eq("id", args.engagementId)
      .maybeSingle();
    if (!engagement) throw new Error("That engagement is gone.");
    const ids = await engagementItemIds(supabase, args.profileId, engagement.id);
    return {
      ownerId: args.profileId,
      title: engagement.title,
      scopeId: engagement.id,
      scopeType: "engagement",
      scope: { mode: "engagements", ids: [engagement.id] },
      itemsInScope: ids.length,
      deliverableKind: null,
    };
  }

  if (!args.workItemId) throw new Error("Nothing to analyse.");
  const { data: item, error } = await supabase
    .from("work_items")
    .select("id, title, owner_id, meta")
    .eq("id", args.workItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error("That item is gone.");

  const ids =
    args.scope === "deliverable" ? await deliverableScopeIds(supabase, item.id) : [item.id];

  return {
    ownerId: item.owner_id,
    title: item.title,
    scopeId: item.id,
    scopeType: args.scope === "deliverable" ? "deliverable" : "item",
    scope: { mode: "items", ids },
    itemsInScope: ids.length,
    deliverableKind: deliverableKindOf(item.meta),
  };
}

/**
 * "What fed this" renders the drafted links themselves rather than a second
 * model pass: the write path is draftLineageFor, and this is its transcript.
 */
export async function renderDraftedLineage(
  supabase: Db,
  deliverableId: string,
  deliverableTitle: string,
): Promise<{ text: string; considered: number }> {
  const { data: rows } = await supabase
    .from("work_item_links")
    .select("from_item_id, relation, rationale, status")
    .eq("to_item_id", deliverableId)
    .order("created_at", { ascending: true });

  const live = (rows ?? []).filter((row) => row.status !== "discarded");
  if (live.length === 0) {
    return {
      text: `Nothing in your record could be evidenced as feeding "${deliverableTitle}". An empty result is a true result: shared topic or the same week is not a link, so nothing was proposed.`,
      considered: 0,
    };
  }

  const { data: items } = await supabase
    .from("work_items")
    .select("id, title, type")
    .in(
      "id",
      live.map((row) => row.from_item_id),
    );
  const itemFor = new Map((items ?? []).map((item) => [item.id, item]));

  const blocks = live
    .map((row) => {
      const item = itemFor.get(row.from_item_id);
      if (!item) return null;
      const relation = RELATION_LABEL[row.relation as LineageRelation] ?? row.relation;
      const state = row.status === "confirmed" ? "Confirmed" : "Proposed";
      return [
        `### ${item.title}`,
        `${relation} · ${item.type} · ${state}`,
        row.rationale ? `\n${row.rationale}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .filter((block): block is string => block !== null);

  return {
    text: [
      `What fed "${deliverableTitle}":`,
      ...blocks,
      "These are proposed links for you to confirm or discard in the What fed this section of the item. Nothing is recorded until you do.",
    ].join("\n\n"),
    considered: live.length,
  };
}
