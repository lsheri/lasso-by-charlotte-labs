/**
 * 21 Nov 2026 (Liam: "need harder blur on background when lasso chat is front and center. both prototype and real
 * app"): the one focus blur. When the chat takes the front (the full screen chat now; the landing chat on Home in
 * Phase 1c), the page behind goes soft enough that no words behind it can be read, while the chat, its greeting,
 * Lasso's messages and the suggestion chips stay crisp, and the left menu stays sharp. Matches the prototype's v9.
 *
 * Shared on purpose: the chat pill uses it, and the click-path step cards (Pane click-path-cards) import it, so every
 * surface that brings something front and center softens the page the same way. Change it here only.
 */
export const FOCUS_BLUR = {
  /** Gaussian blur on the page behind, in px. */
  blurPx: 26,
  /** How much of the page colour washes over it: 0.58 means the page shows at 42 percent. */
  wash: 0.58,
  /** How much colour drains out: 0.25 means saturate(0.75). */
  desaturate: 0.25,
  /** A touch smaller, so the page reads as set back. */
  shrink: 0.015,
  /** The morph it animates with, as the pill's own. */
  ms: 600,
  easing: "cubic-bezier(0.45, 0, 0.2, 1)",
} as const;

/** The page behind at `amount` of the way to focused (0 none, 1 full), for a drag that scrubs it. */
export function focusBlurAt(amount: number): { filter: string; opacity: number; transform: string } {
  const t = Math.min(1, Math.max(0, Number.isFinite(amount) ? amount : 0));
  return {
    filter: `blur(${(FOCUS_BLUR.blurPx * t).toFixed(2)}px) saturate(${(1 - FOCUS_BLUR.desaturate * t).toFixed(3)})`,
    opacity: Number((1 - FOCUS_BLUR.wash * t).toFixed(3)),
    transform: `scale(${(1 - FOCUS_BLUR.shrink * t).toFixed(4)})`,
  };
}

/** The same at rest, as CSS declarations, for a stylesheet or an inline style. */
export const FOCUS_BLUR_CSS = focusBlurAt(1);
