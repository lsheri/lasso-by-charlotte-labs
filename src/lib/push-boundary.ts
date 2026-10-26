/**
 * PUSH-2a. Where a later push of a captured chat begins. A turn's push_id is
 * the push it first arrived in and is never moved by a revision, so a push
 * starts at the lowest turn_no carrying its id. The chat's own first turn
 * never draws a rule: everything before it arrived together.
 */
export function pushBoundaries(
  turns: readonly { turn_no: number; push_id?: string | null }[],
): Map<number, string> {
  const out = new Map<number, string>();
  if (turns.length === 0) return out;
  const chatFirst = Math.min(...turns.map((t) => t.turn_no));
  const firstOfPush = new Map<string, number>();
  for (const t of turns) {
    if (!t.push_id) continue;
    const seen = firstOfPush.get(t.push_id);
    if (seen === undefined || t.turn_no < seen) firstOfPush.set(t.push_id, t.turn_no);
  }
  for (const [pushId, turnNo] of firstOfPush) {
    if (turnNo !== chatFirst) out.set(turnNo, pushId);
  }
  return out;
}

/** "Added 21 Oct", in the reader's local day. The year shows only when it is not this year. Never a time. */
export function addedLabel(iso: string, now: Date = new Date()): string | null {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  const sameYear = when.getFullYear() === now.getFullYear();
  const day = when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  return `Added ${day}`;
}
