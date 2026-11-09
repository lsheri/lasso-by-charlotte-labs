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
/** LIFT-6: the box moves for this long; the content fades in over its second half. */
export const LIFT_MORPH_MS = 240;
/** LIFT-6 (Liam, 9 Nov): the lifted view has slightly rounded corners. */
export const LIFT_RADIUS = 12;

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
 * Which cards lift on a double-click. LIFT-6 (Liam, 9 Nov: "the same for all document types and images"):
 * every card that carries work lifts, whatever it is and however it arrived: a chat, a document, a deck,
 * a sheet, a file, an email, a piece captured from a chat with no bytes yet, and the decisions document
 * (Expand still opens its ledger). Images and videos lift through the same view. Cards without a work
 * item (a local note, a text block) keep double-click to edit: they are the editor, not work to read.
 */
export function liftable(item: LiftableItem): boolean {
  return Boolean(item?.type);
}

/** The kind of work on a lift event: the work type, a chat called a chat. A closed set, never a title. */
export const LIFT_KINDS = [
  "chat",
  "document",
  "deck",
  "sheet",
  "call",
  "email",
  "message",
  "image",
  "video",
  "other",
] as const;
export type LiftKind = (typeof LIFT_KINDS)[number];
const LIFT_WORK_TYPES: readonly string[] = [
  "document",
  "deck",
  "sheet",
  "call",
  "email",
  "message",
  "image",
  "video",
];
export function liftKindOf(type: string | null | undefined): LiftKind {
  if (type === "ai_thread") return "chat";
  if (type && LIFT_WORK_TYPES.includes(type)) return type as LiftKind;
  return "other";
}

/** How far the 480 px authored preview is enlarged inside the view: fill the width, never past 1.5. */
export const LIFT_AUTHOR_WIDTH = 480;
export function liftZoom(bodyWidth: number): number {
  const fit = (bodyWidth - 48) / LIFT_AUTHOR_WIDTH;
  return Math.round(Math.min(1.5, Math.max(1, fit)) * 100) / 100;
}

/**
 * LIFT-6: the morph is a transform, never a layout change. The view is laid out once at its final box;
 * this is the transform that makes that box sit exactly on the card's box. Animating it to "none" grows
 * the view out of the card, and back to it shrinks the view into the card, with nothing inside reflowing.
 */
export function liftFlip(from: LiftRect, to: LiftRect): string {
  const sx = to.width > 0 ? from.width / to.width : 1;
  const sy = to.height > 0 ? from.height / to.height : 1;
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return `translate(${r(from.left - to.left)}px, ${r(from.top - to.top)}px) scale(${r(sx)}, ${r(sy)})`;
}
