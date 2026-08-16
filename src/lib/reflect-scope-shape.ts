import type { ContextScope } from "@/lib/reflect-shared";
import { isDeliverableType } from "@/lib/lineage-shared";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * What a chat's scope actually points at, worked out on the client from the
 * same mapping the Work page reads. Mapping is the consent act, so anything
 * unmapped or private is out of every shape except whole record.
 */

export function engagementIdsOf(item: WorkItemRow): string[] {
  return Array.from(
    new Set(
      item.work_item_tasks
        .map((m) => m.tasks?.engagement_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
}

/**
 * The pieces of work a message points at with @ tags. A tag is the item title
 * written verbatim after an @, which is exactly what the picker inserts.
 */
export function pointedAtIds(text: string, items: { id: string; title: string }[]): string[] {
  if (!text.includes("@")) return [];
  const haystack = text.toLowerCase();
  const ids: string[] = [];
  for (const item of items) {
    const title = item.title.trim().toLowerCase();
    if (title && haystack.includes(`@${title}`)) ids.push(item.id);
  }
  return Array.from(new Set(ids));
}



export function taskIdsOf(item: WorkItemRow): string[] {
  return item.work_item_tasks.map((m) => m.task_id);
}

/** The pieces of work a scope resolves to, in the order the record holds them. */
export function itemsInScope(scope: ContextScope, all: WorkItemRow[]): WorkItemRow[] {
  if (scope.mode === "whole") return all;
  if (scope.mode === "items") return all.filter((i) => scope.ids.includes(i.id));
  if (scope.mode === "tasks")
    return all.filter((i) => taskIdsOf(i).some((id) => scope.ids.includes(id)));
  return all.filter((i) => engagementIdsOf(i).some((id) => scope.ids.includes(id)));
}

/** Everything mapped into one engagement. The selector's universe. */
export function mappedItemsForEngagement(all: WorkItemRow[], engagementId: string): WorkItemRow[] {
  return all.filter((i) => i.visibility === "mapped" && engagementIdsOf(i).includes(engagementId));
}

export type ChipShape =
  | { kind: "item"; item: WorkItemRow; scope: "thread" | "deliverable" }
  | { kind: "engagement"; engagementId: string; itemCount: number }
  | { kind: "none"; reason: "multiple" | "empty" };

/**
 * Which analyses belong on this chat. One conversation shows the thread
 * analyses, one deliverable shows the deliverable analyses, anything wider
 * shows the engagement analyses when a single engagement can be named.
 */
export function chipShape(scope: ContextScope, all: WorkItemRow[]): ChipShape {
  const resolved = itemsInScope(scope, all);
  if (scope.mode === "items" && resolved.length === 1) {
    const item = resolved[0]!;
    return { kind: "item", item, scope: isDeliverableType(item.type) ? "deliverable" : "thread" };
  }
  const engagements = new Set(resolved.flatMap(engagementIdsOf));
  if (scope.mode === "engagements" && scope.ids.length === 1) {
    const id = scope.ids[0]!;
    return {
      kind: "engagement",
      engagementId: id,
      itemCount: mappedItemsForEngagement(all, id).length,
    };
  }
  if (engagements.size === 1) {
    const id = Array.from(engagements)[0]!;
    return { kind: "engagement", engagementId: id, itemCount: resolved.length };
  }
  // No single subject can be named. Tell the caller why, so the surface can
  // offer a way forward instead of rendering nothing.
  const anyMapped = all.some((i) => i.visibility === "mapped" && engagementIdsOf(i).length > 0);
  return { kind: "none", reason: anyMapped ? "multiple" : "empty" };
}
