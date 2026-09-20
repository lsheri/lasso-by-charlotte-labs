/**
 * B5: files attached to an engagement's brief.
 *
 * Pure helpers only. Where an attached card lands on the workboard, which
 * attachments still need their link from the brief card, and the two shapes
 * the create confirm can take. No React, no database, no DOM.
 */

import type { Point } from "@/lib/canvas-drag";
import { PLACEMENT_GAP, placeAddedCards, type PlacementRect } from "@/lib/workboard-placement";

export type BriefAttachmentCard = { nodeId: string; workItemId: string };

/**
 * The attachments whose card sits on the board and has no context link from
 * the brief card yet. Anything already linked is left exactly where it is.
 */
export function pendingBriefAttachments(
  workItemIds: string[],
  nodes: { id: string; workItemId?: string | null }[],
  links: { fromId: string; toId: string; relation?: string | undefined }[],
  briefNodeId = "brief",
): BriefAttachmentCard[] {
  const seen = new Set<string>();
  const pending: BriefAttachmentCard[] = [];
  for (const workItemId of workItemIds) {
    if (!workItemId || seen.has(workItemId)) continue;
    seen.add(workItemId);
    const node = nodes.find((entry) => entry.workItemId === workItemId);
    if (!node) continue;
    const linked = links.some(
      (link) =>
        link.fromId === briefNodeId &&
        link.toId === node.id &&
        (link.relation ?? "context") === "context",
    );
    if (linked) continue;
    pending.push({ nodeId: node.id, workItemId });
  }
  return pending;
}

/**
 * A single column immediately to the right of the brief card, on the grid and
 * keeping the usual clear space from everything already on the board.
 */
export function briefAttachmentPoints(
  brief: { x: number; y: number; width: number },
  taken: PlacementRect[],
  count: number,
): Point[] {
  const anchor = { x: brief.x + brief.width + PLACEMENT_GAP, y: brief.y };
  return placeAddedCards(anchor, taken, count, { columns: 1 });
}

export type BriefConfirmShape = { message: string; submitLabel: string };

/**
 * The confirm shown when someone creates without writing a brief. With files
 * attached the ask is for one summarizing line; with nothing at all it is the
 * original sentence. Neither shape ever blocks the person.
 */
export function briefConfirmShape(input: {
  hasBriefText: boolean;
  fileCount: number;
}): BriefConfirmShape | null {
  if (input.hasBriefText) return null;
  if (input.fileCount > 0) {
    return {
      message:
        "Add a sentence summarizing the brief? The files carry the detail. One line says what the work is measured against.",
      submitLabel: "Create without a summary",
    };
  }
  return {
    message:
      "Create without a brief? Drift analysis and Firm checks will say no brief is in the record until one exists.",
    submitLabel: "Create without a brief",
  };
}
