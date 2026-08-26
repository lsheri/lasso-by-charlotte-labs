/**
 * Pass 124: the Overview learns open from locked. Open is a deliverable still
 * being worked. Locked is one the person declared finished (delivered or
 * accepted) or shipped to the firm archive. Set aside stays out of both: it is
 * neither open work nor finished work.
 */

import { normalizeDeliverableStatus } from "@/lib/firm-dashboard-shared";

export const OPEN_SECTION_LABEL = "OPEN WORK";
export const LOCKED_SECTION_LABEL = "LOCKED WORK — SUBMITTED & SHIPPED";
export const OPEN_EMPTY_LINE = "NOTHING OPEN RIGHT NOW.";
export const LOCKED_EMPTY_LINE = "NOTHING SUBMITTED YET. FINISHED WORK SETTLES HERE.";

export type DeliverableCardRow = {
  /** The tasks row id: the deliverable itself. */
  id: string;
  name: string;
  status: string;
  delivered_at: string | null;
  accepted_at: string | null;
  engagement_id: string;
  engagement_title: string | null;
  engagement_code: string | null;
  client_label: string | null;
  /** True when any work item on this deliverable sits in the firm archive. */
  shipped: boolean;
};

export function isLockedDeliverable(row: DeliverableCardRow): boolean {
  const status = normalizeDeliverableStatus(row.status);
  return row.shipped || status === "delivered" || status === "accepted";
}

export function partitionDeliverables(rows: readonly DeliverableCardRow[]): {
  open: DeliverableCardRow[];
  locked: DeliverableCardRow[];
} {
  const open: DeliverableCardRow[] = [];
  const locked: DeliverableCardRow[] = [];
  for (const row of rows) {
    if (isLockedDeliverable(row)) {
      locked.push(row);
      continue;
    }
    // "Set aside" is not open work; it settles nowhere on this page.
    if (normalizeDeliverableStatus(row.status) === "set_aside") continue;
    open.push(row);
  }
  return { open, locked };
}
