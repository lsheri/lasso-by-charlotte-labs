/**
 * B5: files attached to an engagement's brief.
 *
 * Pure helpers only. Where an attached card lands on the workboard, which
 * attachments still need their link from the brief card, and the two shapes
 * the create confirm can take. No React, no database, no DOM.
 */

import { DRAG_STEP, snapPoint, type Point } from "@/lib/canvas-drag";
import { PLACEMENT_CARD, PLACEMENT_GAP, slotIsFree, type PlacementRect } from "@/lib/workboard-placement";


export type BriefAttachmentCard = { nodeId: string; workItemId: string };

/**
 * The attachments whose card sits on the board and has no context link from
 * the brief card yet. Anything already linked is left exactly where it is.
 */
export function pendingBriefAttachments(
  workItemIds: string[],
  nodes: { id: string; workItemId?: string | null | undefined }[],
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
 * keeping the usual clear space from every other card.
 *
 * The search only ever walks down, and then across to the next column on the
 * right. It never drifts up or to the left of the brief: a card that came in
 * with the brief has to read as sitting beside it. Workstream outlines are not
 * occupied space here, since cards live inside them.
 */
export function briefAttachmentPoints(
  brief: { x: number; y: number; width: number },
  taken: PlacementRect[],
  count: number,
): Point[] {
  const size = PLACEMENT_CARD;
  const stepX = Math.ceil((size.width + PLACEMENT_GAP) / DRAG_STEP) * DRAG_STEP;
  const stepY = Math.ceil((size.height + PLACEMENT_GAP) / DRAG_STEP) * DRAG_STEP;
  const base = snapPoint({ x: brief.x + brief.width + PLACEMENT_GAP, y: brief.y });
  const occupied = [...taken];
  const points: Point[] = [];
  for (let index = 0; index < Math.max(0, count); index += 1) {
    let landed: Point = { x: base.x + index * 0, y: base.y + index * stepY };
    search: for (let column = 0; column < 12; column += 1) {
      for (let row = 0; row < 40; row += 1) {
        const point = { x: base.x + column * stepX, y: base.y + row * stepY };
        if (slotIsFree({ ...point, ...size }, occupied, PLACEMENT_GAP)) {
          landed = point;
          break search;
        }
      }
    }
    points.push(landed);
    occupied.push({ ...landed, ...size });
  }
  return points;
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
