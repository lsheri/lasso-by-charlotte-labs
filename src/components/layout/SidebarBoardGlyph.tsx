import { GraphiteIcon } from "@/components/notebook/icons";
import { fnv1a } from "@/lib/journey-path";

/** Stable presentation only; missing ids use neutral ink. */
export function boardHueIndex(boardId: string | null | undefined): number {
  return boardId ? fnv1a(boardId) % 8 : 0;
}

export function SidebarBoardGlyph({ boardId }: { boardId?: string | null }) {
  return (
    <span className="lasso-board-glyph inline-flex shrink-0" aria-hidden="true"
      style={{ color: `var(--board-hue-${boardHueIndex(boardId)}-ink)` }}>
      <GraphiteIcon name="workboard" size={20} />
    </span>
  );
}
