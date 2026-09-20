/**
 * Per-viewer, per-board view choices that are not worth a database row.
 *
 * The workstream outlines are off unless this viewer turned them on for this
 * board before, so a first open is a plain board.
 */

import type { LabStructureMode } from "@/components/canvas-lab/canvas-lab-model";

export function workboardStructureModeKey(profileId: string, engagementId: string): string {
  return `lasso:workboard:${profileId}:${engagementId}:structure`;
}

/** Anything other than a stored "structured" reads as freeform. */
export function readWorkboardStructureMode(value: string | null | undefined): LabStructureMode {
  return value === "structured" ? "structured" : "freeform";
}

/**
 * The example board is offered only while a board is close to empty. The brief
 * card is seeded for everyone, so it never counts towards the three.
 */
export function boardIsNearEmpty(nodes: readonly { kind: string }[]): boolean {
  return nodes.filter((node) => node.kind !== "brief").length < 3;
}
