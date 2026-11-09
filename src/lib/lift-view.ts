import { isReferenceItem } from "@/lib/reference-file-shared";

/**
 * LIFT (claude/SPEC-nov09-LIFT-double-click-lifts-work.md): the geometry and the rules for the view a
 * piece of work lifts into. Pure, so the shell stays thin and these stay tested.
 *
 * Liam's rule: it always opens at one default size. A move or a resize lasts until the view closes;
 * nothing here is saved, and nothing here writes to the board.
 */

export type LiftRect = { left: number; top: number; width: number; height: number };
export type LiftViewport = { width: number; height: number };
export type LiftCorner = "nw" | "ne" | "se" | "sw";

/** The default: 760 by 600, or 70% of the window's width by 75% of its height when the window is smaller. */
export const LIFT_DEFAULT = {
  width: 760,
  height: 600,
  widthShare: 0.7,
  heightShare: 0.75,
} as const;
/** Small enough to compress by hand, large enough that the header and a few lines still show. */
export const LIFT_MIN = { width: 320, height: 240 } as const;
/** Keep this much of the view on screen while it is dragged, so its header can always be caught again. */
export const LIFT_KEEP_ON_SCREEN = 80;
export const LIFT_MORPH_MS = 200;

export function liftDefaultSize(viewport: LiftViewport): { width: number; height: number } {
  return {
    width: Math.round(
      Math.max(
        LIFT_MIN.width,
        Math.min(LIFT_DEFAULT.width, viewport.width * LIFT_DEFAULT.widthShare),
      ),
    ),
    height: Math.round(
      Math.max(
        LIFT_MIN.height,
        Math.min(LIFT_DEFAULT.height, viewport.height * LIFT_DEFAULT.heightShare),
      ),
    ),
  };
}

export function liftCentred(
  viewport: LiftViewport,
  size: { width: number; height: number },
): LiftRect {
  return {
    left: Math.round((viewport.width - size.width) / 2),
    top: Math.round((viewport.height - size.height) / 2),
    width: size.width,
    height: size.height,
  };
}

/** Where a lift opens: always the default size, centred. */
export function liftOpenRect(viewport: LiftViewport): LiftRect {
  return liftCentred(viewport, liftDefaultSize(viewport));
}

/** A drag of the header: the view follows, but enough of it stays on screen to catch it again. */
export function liftMoved(
  start: LiftRect,
  dx: number,
  dy: number,
  viewport: LiftViewport,
): LiftRect {
  const keep = LIFT_KEEP_ON_SCREEN;
  const left = Math.min(viewport.width - keep, Math.max(keep - start.width, start.left + dx));
  const top = Math.min(viewport.height - keep, Math.max(0, start.top + dy));
  return { ...start, left: Math.round(left), top: Math.round(top) };
}

/** A corner drag: the opposite corner stays put, the size stays between the minimum and the window. */
export function liftResized(
  start: LiftRect,
  corner: LiftCorner,
  dx: number,
  dy: number,
  viewport: LiftViewport,
): LiftRect {
  const right = start.left + start.width;
  const bottom = start.top + start.height;
  const west = corner === "nw" || corner === "sw";
  const north = corner === "nw" || corner === "ne";
  const maxWidth = Math.max(LIFT_MIN.width, viewport.width);
  const maxHeight = Math.max(LIFT_MIN.height, viewport.height);
  const width = Math.min(
    maxWidth,
    Math.max(LIFT_MIN.width, west ? start.width - dx : start.width + dx),
  );
  const height = Math.min(
    maxHeight,
    Math.max(LIFT_MIN.height, north ? start.height - dy : start.height + dy),
  );
  return {
    left: Math.round(west ? right - width : start.left),
    top: Math.round(north ? bottom - height : start.top),
    width: Math.round(width),
    height: Math.round(height),
  };
}

type LiftableItem =
  | {
      type?: string | null | undefined;
      doc_kind?: string | null | undefined;
      content_fidelity?: string | null | undefined;
    }
  | null
  | undefined;

/**
 * Which cards lift on a double-click. Work only: a chat, document, deck, sheet, file, email or artifact.
 * Not the decisions document (it has its own ledger), and not a file piece whose bytes were never added
 * (there is nothing to read yet; double-click still opens it). Cards without a work item (a local note)
 * keep their own double-click.
 */
export function liftable(item: LiftableItem): boolean {
  if (!item?.type) return false;
  if (item.type === "document" && item.doc_kind === "decisions") return false;
  if (isReferenceItem(item)) return false;
  return true;
}

/** How far the 480 px authored preview is enlarged inside the view: fill the width, never past 1.5. */
export const LIFT_AUTHOR_WIDTH = 480;
export function liftZoom(bodyWidth: number): number {
  const fit = (bodyWidth - 48) / LIFT_AUTHOR_WIDTH;
  return Math.round(Math.min(1.5, Math.max(1, fit)) * 100) / 100;
}
