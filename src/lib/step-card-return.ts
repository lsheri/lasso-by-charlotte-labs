/**
 * 21 Nov 2026, click path cards (QA round 2 of PR 304): the chat's "Back to the card" after the person has moved on.
 * Every step card that offers "Ask Lasso about this" registers its way to reopen under a key while it is mounted
 * (Proposals' card for one proposal, the Lead's final for one proposal, and so on). The chat then reopens a card that
 * is still here, goes back to the card's page and reopens it once it mounts there, or, when no card with that key
 * mounts (the proposal is gone, or the person may no longer see it), says so and drops the line. Nothing typed on a
 * card is kept here; only the key and the page.
 */

const live = new Map<string, () => void>();
let pending: { key: string; until: number } | null = null;

/** How long the chat waits, after going back to a card's page, for that card to mount. */
export const CARD_RETURN_WAIT_MS = 4000;

/** A mounted card's way back. Returns the unregister. A card the chat is waiting for opens as it registers. */
export function registerCardReturn(key: string, reopen: () => void, now = Date.now()): () => void {
  live.set(key, reopen);
  if (pending && pending.key === key) {
    const due = pending.until >= now;
    pending = null;
    if (due) globalThis.setTimeout?.(reopen, 0);
  }
  return () => {
    if (live.get(key) === reopen) live.delete(key);
  };
}

/** Whether a card with this key is mounted now. */
export function cardIsHere(key: string): boolean {
  return live.has(key);
}

/** Reopens a mounted card. False when none is here. */
export function reopenCard(key: string): boolean {
  const reopen = live.get(key);
  if (!reopen) return false;
  reopen();
  return true;
}

/** Asks for a card to reopen as soon as it mounts (after the chat has gone back to its page). */
export function awaitCard(key: string, now = Date.now()): void {
  pending = { key, until: now + CARD_RETURN_WAIT_MS };
}

/** True once a wait has run out with no card: the chat says it is gone. Clears the wait. */
export function cardNeverCame(key: string): boolean {
  if (!pending || pending.key !== key) return false;
  pending = null;
  return true;
}

/** Only the page part of an address, for comparing where the person is with where the card was. */
export function pageOf(href: string): string {
  return (href.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
}

/** For tests. */
export function resetCardReturns(): void {
  live.clear();
  pending = null;
}
