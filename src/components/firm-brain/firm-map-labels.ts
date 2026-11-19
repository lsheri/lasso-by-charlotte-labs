/**
 * Which labels on the 3D firm map give way when they would sit on top of each other. Pure, so the rule is tested
 * without WebGL: FirmMap3D projects each label to the screen every frame and hides the ones this returns.
 */

/** A label's box on screen: its centre, its drawn size, and its rank (lower keeps its place first). */
export interface LabelBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
}

/** Space, in pixels, two labels keep between them. */
export const LABEL_GAP = 6;

/**
 * The ids to hide. Labels are taken in rank order (ties by id, so the answer never depends on input order); each
 * keeps its place only if it clears every label already kept by `gap`. A box with no size is unmeasured and is
 * always kept, since nothing can be said about what it covers.
 */
export function crowdedLabels(boxes: readonly LabelBox[], gap: number = LABEL_GAP): Set<string> {
  const hidden = new Set<string>();
  const kept: LabelBox[] = [];
  const ordered = [...boxes].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  for (const box of ordered) {
    if (!(box.width > 0) || !(box.height > 0) || !Number.isFinite(box.x + box.y)) continue;
    const clash = kept.some(
      (other) =>
        Math.abs(box.x - other.x) < (box.width + other.width) / 2 + gap &&
        Math.abs(box.y - other.y) < (box.height + other.height) / 2 + gap,
    );
    if (clash) hidden.add(box.id);
    else kept.push(box);
  }
  return hidden;
}

/**
 * A label's rank. What the person pulled comes first, then situations, engagement names, methods; nearer the camera
 * wins within a kind, and a label already showing holds on against a near tie so labels do not flicker as the map
 * turns.
 */
export function labelRank(input: {
  kind: "situation" | "method" | "deck" | "lesson";
  dim: boolean;
  distance: number;
  showing: boolean;
}): number {
  const kind = input.kind === "situation" ? 0 : input.kind === "deck" ? 1 : 2;
  const near = Math.max(0, Math.min(0.99, input.distance / 4000));
  return (input.dim ? 10 : 0) + kind + near - (input.showing ? 0.05 : 0);
}
