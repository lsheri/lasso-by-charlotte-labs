import { displayName } from "@/lib/work-item-name";
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
export function pointedAtIds(
  text: string,
  items: { id: string; title: string; display_title?: string | null | undefined }[],
): string[] {
  if (!text.includes("@")) return [];
  const haystack = text.toLowerCase();
  // ASK-FIX-4: @ matches the name on the card (the chosen name) as well as the original title,
  // so a renamed piece can still be pointed at.
  const named = items.map((item) => ({
    id: item.id,
    names: [...new Set([displayName(item), item.title].map((name) => (name ?? "").trim().toLowerCase()).filter(Boolean))],
  }));
  const ids: string[] = [];
  // ASK-FIX-6: each @ points at the longest name that matches there and ends at a word boundary, so
  // "@Kickoff call" means the card "Kickoff call", not also "Kickoff", and "@Kickoff" never means "Kickoff call".
  for (let at = haystack.indexOf("@"); at !== -1; at = haystack.indexOf("@", at + 1)) {
    let best = 0;
    let hits: string[] = [];
    for (const item of named) {
      for (const name of item.names) {
        if (name.length < best || !haystack.startsWith(name, at + 1) || !endsAtBoundary(haystack, at + 1 + name.length)) continue;
        if (name.length > best) { best = name.length; hits = []; }
        hits.push(item.id);
      }
    }
    ids.push(...hits);
  }
  return Array.from(new Set(ids));
}

/** ASK-FIX-6: a name ends where the text ends or the next character is not a letter or digit. */
function endsAtBoundary(text: string, index: number): boolean {
  const next = text.charAt(index);
  return next === "" || !/[\p{L}\p{N}]/u.test(next);
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

export function boardSelectionScope(input: {
  engagementId: string;
  hasBoardPicks: boolean;
  mappedIds: string[];
  imageIds?: string[];
}): ContextScope {
  if (!input.hasBoardPicks || (input.mappedIds.length === 0 && !input.imageIds?.length)) {
    return { mode: "engagements", ids: [input.engagementId] };
  }
  return { mode: "items", ids: input.mappedIds, ...(input.imageIds ? { images: input.imageIds } : {}) };
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

/**
 * Whether a saved chat belongs on an engagement page. The founder's rule:
 * an engagement lists only the chats scoped to that engagement, one of its
 * workstreams, or a piece of work mapped into it. A whole record chat is a
 * chat about everything, so it is not "related to" this engagement.
 */
export function sessionRelatedToEngagement(
  scope: ContextScope,
  where: { engagementId: string; mappedItemIds: Iterable<string>; taskIds: Iterable<string> },
): boolean {
  if (!scope || scope.mode === "whole") return false;
  const ids = scope.ids ?? [];
  if (ids.length === 0) return false;
  if (scope.mode === "engagements") return ids.includes(where.engagementId);
  if (scope.mode === "tasks") {
    const tasks = new Set(where.taskIds);
    return ids.some((id) => tasks.has(id));
  }
  const items = new Set(where.mappedItemIds);
  return ids.some((id) => items.has(id));
}
