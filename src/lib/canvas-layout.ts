export const NODE_W_SOURCE = 168;
export const NODE_H_SOURCE = 84;
export const NODE_W_DELIVERABLE = 232;
export const NODE_H_DELIVERABLE = 112;
export const CANVAS_GRID = 22;

export type LayoutInput = {
  deliverables: string[];
  linksBySource: Map<string, string[]>;
};

export type Placed = {
  id: string;
  x: number;
  y: number;
  kind: "deliverable" | "source";
};

const snap = (value: number) => Math.round(value / CANVAS_GRID) * CANVAS_GRID;

/** Deliverables in a column; each one's sources stacked to its left. */
export function seedLayout(input: LayoutInput): Placed[] {
  const placed: Placed[] = [];
  const usedSources = new Set<string>();

  input.deliverables.forEach((deliverableId, deliverableIndex) => {
    const sources = Array.from(input.linksBySource.entries())
      .filter(([sourceId, targets]) => !usedSources.has(sourceId) && targets.includes(deliverableId))
      .map(([sourceId]) => sourceId);
    if (sources.length === 0) return;

    const deliverableY = 80 + deliverableIndex * 260;
    placed.push({
      id: deliverableId,
      x: snap(560),
      y: snap(deliverableY),
      kind: "deliverable",
    });

    const sourceCentreY = deliverableY + NODE_H_DELIVERABLE / 2 - NODE_H_SOURCE / 2;
    const firstSourceY = sourceCentreY - ((sources.length - 1) * 104) / 2;
    sources.forEach((sourceId, sourceIndex) => {
      usedSources.add(sourceId);
      placed.push({
        id: sourceId,
        x: snap(140),
        y: snap(firstSourceY + sourceIndex * 104),
        kind: "source",
      });
    });
  });

  return placed;
}