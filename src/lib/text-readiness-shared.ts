/**
 * 20 Nov 2026, chat pill Phase 0 (Liam, D-97): the sender counts as ready only when it can send.
 *
 * Settings being in place is not enough. While the carriers have not accepted our number, every send is refused, and
 * a demo that answers "The text was not accepted" is not real or clickable. So a refusal from the provider pauses
 * sending for a short while: in that time a demo workspace gets practice asks again, and a real workspace is told
 * plainly that texts have not started and can record a lead's answer by hand. After the pause the next press tries
 * once more, so the day the number is accepted, texts start with no change to the app.
 *
 * The pure rule and the words. The server reads when the last refusal was (text-sender.server.ts).
 */

/** How long one refusal pauses sending. */
export const SENDER_PAUSE_MS = 15 * 60_000;

/**
 * Whether sending is paused at `now` by a refusal at `lastRefusalMs`. A stamp a little in the future (two clocks that
 * disagree) counts as now; the server never keeps a future stamp, it stores the earlier of the stamp and its own clock.
 */
export function senderPaused(lastRefusalMs: number | null | undefined, nowMs: number): boolean {
  if (typeof lastRefusalMs !== "number" || !Number.isFinite(lastRefusalMs)) return false;
  return nowMs - Math.min(lastRefusalMs, nowMs) < SENDER_PAUSE_MS;
}

/** Whether the sender is ready: settings in place and not paused. */
export function senderReady(input: {
  configured: boolean;
  lastRefusalMs: number | null | undefined;
  nowMs: number;
}): boolean {
  return input.configured && !senderPaused(input.lastRefusalMs, input.nowMs);
}

/** The words while texts have not started. Never names the sending service. */
export const TEXTS_NOT_STARTED_COPY = {
  /** The answer to a press in a real workspace (Liam's words, D-97). */
  nothingSent: "Texts start once our number is approved. Nothing was sent.",
  /** Said before a press in a real workspace. */
  nothingWillBeSent: "Texts start once our number is approved, so nothing will be sent yet.",
  /** Said once on the lead sheet's list in a real workspace. */
  sheet: "Texts start once our number is approved. Nothing is sent until then.",
  /** A demo workspace: the press makes a practice ask. */
  practice:
    "Texts start once our number is approved, so this is a practice ask. Nothing is sent to any phone.",
  practiceThenAnswer:
    "Texts start once our number is approved, so this is a practice ask. Nothing is sent to any phone. You can then answer it here as the lead would.",
} as const;
