import { StickyMark } from "@/components/canvas-lab/StickyMark";

/*
 * S3 (stickies on the work, 10 Nov, Liam): a card on the board says it carries stickies with one small
 * real-paper sticky stuck over its top corner, the count on it. It counts stickies on the work, never
 * anything about a person. Pressing it opens the work in the one view on its Stickies tab.
 */

export const CORNER_STICKY_COPY = {
  label: (count: number) => `${count} open ${count === 1 ? "sticky" : "stickies"} on this work`,
} as const;

export function CardCornerSticky({
  count,
  onOpen,
}: {
  count: number;
  onOpen?: (() => void) | undefined;
}) {
  if (count <= 0) return null;
  const shown = count > 9 ? "9+" : String(count);
  return (
    <button
      type="button"
      className="card-corner-sticky"
      data-testid="card-corner-sticky"
      aria-label={CORNER_STICKY_COPY.label(count)}
      title={CORNER_STICKY_COPY.label(count)}
      disabled={!onOpen}
      onPointerDown={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onOpen?.();
      }}
    >
      <StickyMark variant="sheet" size={34} lines={false} />
      <span aria-hidden="true">{shown}</span>
    </button>
  );
}
