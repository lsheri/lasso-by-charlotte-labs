/**
 * ASK-FIX-3 (ask-v2): Enter while an answer is still finishing used to do nothing visible
 * (the question sat in the box, and the key added a new line). Under ask-v2 the question is
 * held and sent the moment the answer is done, with a line saying so.
 */
export const ASK_QUEUE_COPY = {
  waiting: "Sends when this answer is done.",
  cancel: "Cancel",
};

type KeyLike = { key: string; shiftKey: boolean; isComposing: boolean; keyCode: number };

/** The same Enter that would send, pressed while Lasso is still answering. */
export function shouldQueueAskOnEnter(
  event: KeyLike,
  isTouch: boolean,
  draft: string,
  pending: boolean,
): boolean {
  return (
    pending &&
    event.key === "Enter" &&
    !event.shiftKey &&
    !event.isComposing &&
    event.keyCode !== 229 &&
    !isTouch &&
    draft.trim().length > 0
  );
}

/** A held question goes only if the box still says it. Editing or clearing the box drops it. */
export function queuedStillWanted(queued: string | null, draft: string): queued is string {
  return queued !== null && queued.length > 0 && draft.trim() === queued;
}
