/**
 * PASS 127 — "What to verify here", thread scoped.
 *
 * The display language of the thread scoped verification reader: the label, the
 * verdict wording, the ink each verdict draws in, and the order the rail reads.
 * Nothing here reads the record; it only says what the record already holds.
 *
 * NO RED. The strongest mark in this feature is amber, because a contradiction
 * is a thing to look at, not a failure of a person.
 */

import type { HandoffItem, OpenCheckItem } from "@/lib/handoffs-shared";

export const VERIFY_THREAD_LABEL = "What to verify here";

/** A run that finds nothing to verify is a true result, said in full. */
export const VERIFY_THREAD_EMPTY_LINE =
  "NOTHING HERE NEEDS A CHECK THAT ISN'T ALREADY VISIBLE IN THE RECORD.";

export type VerifyVerdict = "contradicted" | "nothing_visible" | "checked";

export type VerifyInkTokens = {
  stroke: string;
  wash: string;
  /** Absence is drawn as a dashed line, so colour is never the only signal. */
  dashed: boolean;
};

/** Verdict to ink. Existing tokens only, and never --destructive. */
export function verdictInk(verdict: string): VerifyInkTokens {
  if (verdict === "contradicted") {
    return { stroke: "var(--status-paraphrase)", wash: "var(--status-paraphrase-wash)", dashed: false };
  }
  if (verdict === "checked") {
    return { stroke: "var(--status-exact)", wash: "var(--status-exact-wash)", dashed: false };
  }
  return { stroke: "var(--nb-ink-yellow)", wash: "var(--status-unsourced-wash)", dashed: true };
}

/** The verdict spelled out, so the mark never depends on its colour. */
export function verdictPhrase(verdict: string): string {
  if (verdict === "contradicted") return "Contradicted in the work or record";
  if (verdict === "checked") return "Checked in the record";
  return "Nothing visible in the captured record";
}

/** The legend, rendered in the final state beside the rail. */
export const VERIFY_LEGEND: readonly { verdict: VerifyVerdict; phrase: string }[] = [
  { verdict: "contradicted", phrase: verdictPhrase("contradicted") },
  { verdict: "nothing_visible", phrase: verdictPhrase("nothing_visible") },
  { verdict: "checked", phrase: verdictPhrase("checked") },
];

const RANK: Record<string, number> = { contradicted: 0, nothing_visible: 1, checked: 2 };

/** Rail order: contradicted, then nothing visible, then checked. Stable. */
export function orderFindings<T extends { fields: OpenCheckItem }>(items: readonly T[]): T[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rank =
        (RANK[a.item.fields.verdict] ?? 1) - (RANK[b.item.fields.verdict] ?? 1);
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** Live findings on a run: drafts only, and only ones that carry an anchor. */
export function verifyFindings(items: readonly HandoffItem[]): (HandoffItem & {
  fields: OpenCheckItem;
})[] {
  return orderFindings(
    items.filter(
      (item): item is HandoffItem & { fields: OpenCheckItem } =>
        item.state !== "discarded" &&
        typeof (item.fields as OpenCheckItem).claim_quote === "string" &&
        typeof (item.fields as OpenCheckItem).evidence_turn_id === "string",
    ),
  );
}
