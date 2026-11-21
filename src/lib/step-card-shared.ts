/**
 * 21 Nov 2026, click path cards (Liam: "clicking through version not using chat should have buttons that pop open
 * pleasant looking white background cards for steps. like the proposals. it shouldnt open chat."). The pure rules of
 * the step card: one white card in the middle of the screen (a bottom sheet on a phone) whose steps morph inside it.
 * The page behind takes the shared focus blur (focus-blur-shared.ts). Nothing here reads a person or a fee.
 */

/** One morph of the card's height, and a step's slide and fade, in ms (the fluid flow's one easing). */
export const STEP_CARD_MORPH_MS = 550;
/** The card or sheet arriving and leaving, in ms. */
export const STEP_CARD_ENTER_MS = 600;
/** Phones get the bottom sheet. Same edge as the chat pill's phone layout. */
export const STEP_CARD_PHONE_MAX = 767;

/** How far down a sheet must be pulled, in px, before letting go closes it. */
export const SHEET_CLOSE_PULL = 110;
/** Or how fast, in px per ms: a flick down closes it from any distance past the slop. */
export const SHEET_CLOSE_FLICK = 0.6;
/** A drag starts after this many px, so a tap on the grabber is still a tap. */
export const SHEET_DRAG_SLOP = 6;

/** Where a sheet goes when the finger lifts: closed, or back up. Pulling up never moves it. */
export function sheetSettle(pullPx: number, velocityPxPerMs: number): "close" | "stay" {
  if (!Number.isFinite(pullPx) || pullPx <= SHEET_DRAG_SLOP) return "stay";
  if (pullPx >= SHEET_CLOSE_PULL) return "close";
  return Number.isFinite(velocityPxPerMs) && velocityPxPerMs >= SHEET_CLOSE_FLICK ? "close" : "stay";
}

/** How far the sheet follows a finger: all the way down, and only a little resistance up (a rubber band). */
export function sheetFollow(dy: number): number {
  if (!Number.isFinite(dy)) return 0;
  return dy >= 0 ? dy : -Math.min(12, Math.sqrt(-dy) * 1.5);
}

/** How much of the focus wash is left while a sheet is pulled down: it lifts as the sheet goes, 1 to 0. */
export function washAt(pullPx: number, sheetHeight: number): number {
  if (!(sheetHeight > 0) || !Number.isFinite(pullPx)) return 1;
  return Math.max(0, Math.min(1, 1 - pullPx / sheetHeight));
}

/** Which way a step change slides: on to a later step from the right, back to an earlier one from the left. */
export function stepDirection(from: number, to: number): "forward" | "back" {
  return to < from ? "back" : "forward";
}

export const STEP_CARD_COPY = {
  /** The quiet marker at the top. */
  stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
  back: "Back",
  close: "Close",
  /** The sheet's grabber, for a screen reader: what pulling it does. */
  grabber: "Pull down to close",
  /** The one way from a card into the chat, and only if the person wants it. */
  askAbout: (brand: string) => `Ask ${brand} about this`,
} as const;
