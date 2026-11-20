/**
 * Where the demo story's card sits and how far the page moves so a beat's target can be seen. Pure geometry.
 *
 * The card's usual place is the bottom of the screen at the start edge. Home can be any height (an admin's Home opens
 * with proposals), so when a beat starts the page is moved until the target sits at the top, clear of the card. If
 * the page cannot move that far, the card moves to a corner where it covers nothing of the target. If no corner is
 * clear, the card stays where it always is.
 */

export type StoryRect = { top: number; left: number; width: number; height: number };
export type StoryPlacement = "bottom-start" | "bottom-end" | "top-start" | "top-end";

export const STORY_DEFAULT_PLACEMENT: StoryPlacement = "bottom-start";

export type StoryLayoutMetrics = {
  card: { width: number; height: number };
  viewport: { width: number; height: number };
  /** The card's left edge in its usual place. */
  startLeft: number;
  /** The gap under the card in its usual place. */
  bottomOffset: number;
  /** How much of the top of the screen is taken by a fixed header. */
  topInset: number;
  /** Wide screens have a start and an end side; a phone's card is centred, so it can only go up or down. */
  wide: boolean;
};

const EDGE = 16;
const GAP = 8;
const BREATH = 12;

/** Where the card's top edge is when it sits at the top. */
export function storyCardTop(metrics: Pick<StoryLayoutMetrics, "topInset">): number {
  return Math.max(EDGE, metrics.topInset + GAP);
}

export function storyPlacementRect(placement: StoryPlacement, metrics: StoryLayoutMetrics): StoryRect {
  const { card, viewport } = metrics;
  const atEnd = metrics.wide && placement.endsWith("end");
  return {
    top: placement.startsWith("top") ? storyCardTop(metrics) : viewport.height - metrics.bottomOffset - card.height,
    left: atEnd ? viewport.width - EDGE - card.width : metrics.startLeft,
    width: card.width,
    height: card.height,
  };
}

function overlap(a: StoryRect, b: StoryRect): number {
  const wide = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const tall = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return wide > 0 && tall > 0 ? wide * tall : 0;
}

/** The part of the target a person can see: on screen and below a fixed header. */
function seen(target: StoryRect, metrics: StoryLayoutMetrics): StoryRect {
  const top = Math.max(target.top, metrics.topInset);
  const bottom = Math.min(target.top + target.height, metrics.viewport.height);
  return { top, left: target.left, width: target.width, height: Math.max(0, bottom - top) };
}

/**
 * The card's place for this target: its usual place unless that covers the target and another corner covers none.
 * A beat can also name its corner on a wide screen (`wideAt`): the Firm brain canvas fills the page and floats its
 * question box at the bottom middle, so no corner clears the target and the usual one would sit on the box.
 * A beat can ask for the top on a phone (`phoneTop`): the firm map is taller than the screen, so no place clears it,
 * and its threads are drawn below the ask box, where the card at the bottom would sit.
 */
export function storyCardPlacement(
  target: StoryRect | null,
  metrics: StoryLayoutMetrics,
  phoneTop = false,
  /** A beat whose target fills the screen can name its corner on a wide screen (21 Nov: the Firm brain canvas). */
  wideAt: StoryPlacement | null = null,
): StoryPlacement {
  if (!target) return STORY_DEFAULT_PLACEMENT;
  if (phoneTop && !metrics.wide) return "top-start";
  if (wideAt && metrics.wide) return wideAt;
  const visible = seen(target, metrics);
  if (overlap(visible, storyPlacementRect(STORY_DEFAULT_PLACEMENT, metrics)) === 0) return STORY_DEFAULT_PLACEMENT;
  const others: StoryPlacement[] = metrics.wide ? ["bottom-end", "top-end", "top-start"] : ["top-start"];
  return others.find((placement) => overlap(visible, storyPlacementRect(placement, metrics)) === 0) ?? STORY_DEFAULT_PLACEMENT;
}

/**
 * How far down the page should move so the target can be seen (negative is up, 0 is stay). A target that fits above
 * the card is left alone when it is already clear, and otherwise put at the top. One that cannot clear the card is
 * put at the top too, so as much of it as possible shows. One that fills most of the screen or more (the firm map) is
 * only moved when its top is out of sight.
 */
export function storyScrollDelta(target: StoryRect, metrics: StoryLayoutMetrics): number {
  const usual = storyPlacementRect(STORY_DEFAULT_PLACEMENT, metrics);
  const wanted = metrics.topInset + BREATH;
  const underCard = target.left < usual.left + usual.width && target.left + target.width > usual.left;
  const floor = (underCard ? usual.top : metrics.viewport.height) - GAP;
  const bottom = target.top + target.height;
  const fits = target.height <= floor - wanted;
  if (fits && target.top >= metrics.topInset && bottom <= floor) return 0;
  // Most of a screen or more: the firm map. It was built to be read from its top with the page where it is.
  const fillsScreen = target.height > (metrics.viewport.height - metrics.topInset) * 0.8;
  if (!fits && fillsScreen && target.top >= metrics.topInset && target.top <= metrics.viewport.height / 2) return 0;
  const delta = Math.round(target.top - wanted);
  return Math.abs(delta) < 4 ? 0 : delta;
}
