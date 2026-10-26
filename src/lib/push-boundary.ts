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

/**
 * "21 Oct", in the reader's local day. The year shows only when it is not
 * this year. Never a time. Shared by the reader's push rule and section markers.
 */
export function dayLabel(when: Date, now: Date = new Date()): string {
  const sameYear = when.getFullYear() === now.getFullYear();
  return when.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Added 21 Oct", in the reader's local day. The year shows only when it is not this year. Never a time. */
export function addedLabel(iso: string, now: Date = new Date()): string | null {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return null;
  return `Added ${dayLabel(when, now)}`;
}

export type PushHistoryRow = {
  id?: string;
  work_item_id: string;
  pushed_at: string;
  mode: string | null;
  turns_added: number | null;
  turns_changed: number | null;
  attachments_added: number | null;
  attachments_changed: number | null;
};

/**
 * PUSH-2c. Per work item, the pushes after the first that actually brought
 * something: drop the earliest push, any "unchanged" push, and any push whose
 * four counts are all zero. pushed_at values come back oldest first.
 */
export function grownDatesByItem(rows: readonly PushHistoryRow[]): Record<string, string[]> {
  const byItem = new Map<string, PushHistoryRow[]>();
  for (const row of rows) {
    if (Number.isNaN(new Date(row.pushed_at).getTime())) continue;
    byItem.set(row.work_item_id, [...(byItem.get(row.work_item_id) ?? []), row]);
  }
  const out: Record<string, string[]> = {};
  for (const [itemId, list] of byItem) {
    const ordered = [...list].sort((a, b) => new Date(a.pushed_at).getTime() - new Date(b.pushed_at).getTime());
    const grew = ordered.slice(1).filter((row) => {
      if (row.mode === "unchanged") return false;
      const total = (row.turns_added ?? 0) + (row.turns_changed ?? 0) + (row.attachments_added ?? 0) + (row.attachments_changed ?? 0);
      return total > 0;
    });
    if (grew.length > 0) out[itemId] = grew.map((row) => row.pushed_at);
  }
  return out;
}

/**
 * ", grown 21 Oct" / ", grown 14, 21 and 28 Oct" / three most recent then
 * " and earlier". Same local day and year rule as addedLabel. Never a time.
 * Returns "" when nothing grew, so the date line stays exactly as it is.
 */
export function grownSuffix(isoDates: readonly string[] | undefined, now: Date = new Date()): string {
  const valid = (isoDates ?? []).map((iso) => new Date(iso)).filter((d) => !Number.isNaN(d.getTime()));
  if (valid.length === 0) return "";
  valid.sort((a, b) => a.getTime() - b.getTime());
  const shown = valid.slice(-3);
  const groups: { tail: string; days: number[] }[] = [];
  for (const d of shown) {
    const label = addedLabel(d.toISOString(), now)?.replace(/^Added /, "") ?? "";
    const tail = label.replace(/^\d+\s*/, "");
    const last = groups[groups.length - 1];
    if (last && last.tail === tail) last.days.push(d.getDate());
    else groups.push({ tail, days: [d.getDate()] });
  }
  const parts: string[] = [];
  for (const group of groups) {
    group.days.forEach((day, index) => parts.push(index === group.days.length - 1 ? `${day} ${group.tail}` : String(day)));
  }
  const joined = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `, grown ${joined}${valid.length > 3 ? " and earlier" : ""}`;
}
