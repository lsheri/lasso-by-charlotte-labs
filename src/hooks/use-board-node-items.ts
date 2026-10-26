import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * BI-5: a board node can point at a work item the viewer may read while its
 * placement link is hidden from them. The placement-derived list stays the
 * first source; this reads only the missing ids, by id, under the same row
 * policies as every other work item read.
 */
export const BOARD_NODE_ITEM_SELECT =
  "id, owner_id, orig_conversation_id, ungrouped_at, title, display_title, type, doc_kind, source, visibility, captured_at, content_ref, created_at_source, work_date, content_fidelity, source_vendor, source_meta, meta, work_item_extracts(summary)";

export function missingNodeItemIds(
  nodes: readonly { workItemId?: string | null | undefined }[],
  known: readonly { id: string }[],
): string[] {
  const have = new Set(known.map((item) => item.id));
  const missing = new Set<string>();
  for (const node of nodes) if (node.workItemId && !have.has(node.workItemId)) missing.add(node.workItemId);
  return [...missing].sort();
}

export async function fetchBoardNodeItems(ids: readonly string[]): Promise<WorkItemRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from("work_items").select(BOARD_NODE_ITEM_SELECT).in("id", [...ids]);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => ({
    ...row,
    meta: row["meta"] ?? null,
    work_item_tasks: [],
  })) as unknown as WorkItemRow[];
}

export function mergeBoardItems(placed: readonly WorkItemRow[], byId: readonly WorkItemRow[]): WorkItemRow[] {
  const have = new Set(placed.map((item) => item.id));
  return [...placed, ...byId.filter((item) => !have.has(item.id))];
}

export function useBoardNodeItems(
  nodes: readonly { workItemId?: string | null | undefined }[],
  placed: readonly WorkItemRow[],
): { items: WorkItemRow[]; pendingIds: ReadonlySet<string> } {
  const missing = missingNodeItemIds(nodes, placed);
  const key = missing.join(":");
  const query = useQuery({
    queryKey: ["board-node-items", key],
    enabled: missing.length > 0,
    queryFn: () => fetchBoardNodeItems(missing),
  });
  const fetched = query.data;
  const items = useMemo(() => mergeBoardItems(placed, fetched ?? []), [placed, fetched]);
  const pendingIds = useMemo(
    () => new Set(query.isPending && missing.length > 0 ? missing : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, query.isPending],
  );
  return { items, pendingIds };
}
