import { flushSync } from "react-dom";

/** The name both dialogs carry during the hand-over, so the browser morphs one box into the other. */
export const PROPOSAL_MORPH = "proposal-morph";

/**
 * 21 Nov 2026 (Liam: "after created it should automatically begin the lead picking process"): New proposal turns
 * into the lead sheet as one box that changes shape, not one dialog closing and another opening. The browser's view
 * transition morphs the box between its two states. Where the browser has no view transitions, or the person asks
 * for reduced motion, the change is made at once, with nothing animated. Resolves once the change is made.
 */
export function morph(update: () => void): Promise<void> {
  const doc = globalThis.document as (Document & { startViewTransition?: (callback: () => void) => { updateCallbackDone?: Promise<void> } }) | undefined;
  const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  if (!doc?.startViewTransition || reduce) {
    update();
    return Promise.resolve();
  }
  // Resolves once the change has been made (the browser runs it a frame later), so the caller can tidy up after it,
  // not before: a form that closes itself first would play its own exit instead of morphing.
  const transition = doc.startViewTransition(() => flushSync(update));
  return Promise.resolve(transition?.updateCallbackDone).catch(() => undefined);
}
