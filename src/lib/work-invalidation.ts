import type { QueryClient } from "@tanstack/react-query";

/**
 * Removing or deleting a piece of work changes what every other surface may
 * honestly say about it. The confirm sheets and the audit resolve live on the
 * server; the client caches are the gap, so they are all dropped here by the
 * key literals actually in use. Prefixes only: React Query matches partially.
 */
export const WORK_CHANGE_KEYS: readonly (readonly unknown[])[] = [
  ["work-items"],
  ["work-item"],
  ["engagement"],
  ["engagement-tasks"],
  ["engagements"],
  ["episode"],
  ["clients"],
  ["briefs"],
  ["brief-tasks"],
  ["engagement-brief-present"],
  ["capture-coverage"],
  ["confirm-item"],
  ["confirm-companions"],
  ["confirm-task-line"],
  ["confirm-unread"],
  ["deliverable-evidence"],
  ["answer-sources"],
  ["decision-source-items"],
  ["decisions"],
  ["firm-checks"],
  ["firm-check-library"],
  ["firm-dashboard"],
  ["query-log"],
];

/** The per-item caches, dropped alongside the lists that count the item. */
export function itemScopedKeys(workItemId: string): readonly (readonly unknown[])[] {
  return [
    ["span-audit", workItemId],
    ["span-audit-rendition", workItemId],
    ["ai-reads", workItemId],
    ["item-text-pane", workItemId],
    ["turns", workItemId],
    ["thread-turn-count", workItemId],
    ["document-versions", workItemId],
    ["lineage", workItemId],
    ["work-file-url", workItemId],
    ["ai-record-links", workItemId],
    ["ai-record-turns", workItemId],
  ];
}

export async function invalidateAfterWorkChange(
  queryClient: QueryClient,
  workItemId: string,
): Promise<void> {
  for (const queryKey of [...WORK_CHANGE_KEYS, ...itemScopedKeys(workItemId)]) {
    await queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}
