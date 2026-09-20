/**
 * The Inbox "Arrived" strip: work the signed-in owner pushed in through the
 * connector in the last seven days. Pure, so the window, the source filter and
 * the wording can be read straight out of a test.
 *
 * Nothing here is stored. The strip is a view over rows the page already has.
 */

import type { WorkItemRow } from "./work-types";

export const ARRIVAL_WINDOW_DAYS = 7;
export const ARRIVAL_WINDOW_MS = ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
/** How many rows the strip shows before "Show all". */
export const ARRIVAL_LIMIT = 8;

/** Work that came in through the connector, whatever the vendor suffix is. */
export function isConnectorArrival(item: { source?: string | null }): boolean {
  return (item.source ?? "").toLowerCase().startsWith("mcp");
}

function arrivedAt(item: WorkItemRow): number | null {
  const value = item.captured_at ?? null;
  if (!value) return null;
  const at = new Date(value).getTime();
  return Number.isNaN(at) ? null : at;
}

/**
 * The owner's own connector pushes inside the window, newest first. Callers
 * slice to ARRIVAL_LIMIT themselves so they can also say how many there are.
 */
export function selectArrivals(
  items: WorkItemRow[],
  ownerId: string | null | undefined,
  now: number = Date.now(),
): WorkItemRow[] {
  if (!ownerId) return [];
  return items
    .filter((item) => item.owner_id === ownerId)
    .filter((item) => isConnectorArrival(item))
    .filter((item) => {
      const at = arrivedAt(item);
      return at !== null && now - at <= ARRIVAL_WINDOW_MS && at - now <= ARRIVAL_WINDOW_MS;
    })
    .sort((a, b) => (arrivedAt(b) ?? 0) - (arrivedAt(a) ?? 0));
}

export type ArrivalPlace =
  | { mapped: false; text: string }
  | { mapped: true; text: string; taskId: string };

/**
 * Where the item is now, in the workspace's own words. A company says "Placed
 * on"; a personal or school workspace says "Filed under". Never who saw it.
 */
export function arrivalPlace(
  item: WorkItemRow,
  orgType: "company" | "personal" | "edu" | null | undefined,
): ArrivalPlace {
  const link = item.work_item_tasks[0];
  const task = link?.tasks;
  if (!link || !task) return { mapped: false, text: "In your inbox" };
  const code = task.engagements?.code ?? "Not set";
  const verb = orgType === "company" ? "Placed on" : "Filed under";
  return { mapped: true, text: `${verb} ${code} · ${task.name}`, taskId: link.task_id };
}

/** "just now", "3h ago", "2d ago". Never more precision than the record has. */
export function arrivalWhen(value: string | null | undefined, now: number = Date.now()): string {
  if (!value) return "";
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "";
  const minutes = Math.floor((now - at) / 60_000);
  if (minutes < 60) return "just now";
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
