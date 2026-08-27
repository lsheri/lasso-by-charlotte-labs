/**
 * PASS 127/128 — "What to fact check", thread scoped.
 *
 * The display language of the thread scoped verification reader: the label, the
 * verdict wording, the ink each verdict draws in, and the order the rail reads.
 * Nothing here reads the record; it only says what the record already holds.
 *
 * NO RED. The strongest mark in this feature is amber, because a contradiction
 * is a thing to look at, not a failure of a person.
 */

import type { HandoffItem, OpenCheckItem } from "@/lib/handoffs-shared";

export const VERIFY_THREAD_LABEL = "What to fact check";

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

/**
 * Verdict to ink. Existing tokens only, and never the destructive token.
 * PASS 131: the two open verdicts draw in the ember family, the same accent
 * family as the conversation starbursts, because amber was too quiet to see.
 */
export function verdictInk(verdict: string): VerifyInkTokens {
  if (verdict === "contradicted") {
    return { stroke: "var(--ember-deep)", wash: "var(--ember-wash)", dashed: false };
  }
  if (verdict === "checked") {
    return { stroke: "var(--status-exact)", wash: "var(--status-exact-wash)", dashed: false };
  }
  return { stroke: "var(--ember-deep)", wash: "var(--ember-wash)", dashed: true };
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

/**
 * Where a claim sits inside a turn. Verbatim only: if the exact span is not in
 * the turn, nothing is marked. The quote promise governs here too.
 */
export function splitByQuote(
  content: string,
  quote: string,
): { before: string; match: string; after: string } | null {
  if (!quote) return null;
  const at = content.indexOf(quote);
  if (at === -1) return null;
  return {
    before: content.slice(0, at),
    match: content.slice(at, at + quote.length),
    after: content.slice(at + quote.length),
  };
}

/** The mark a transcript renders: one span, one verdict, one turn. */
export type ThreadMark = {
  id: string;
  turnNo: number;
  quote: string;
  verdict: string;
  /** Drafts draw bold. A settled finding keeps its ink, quietly. */
  bold?: boolean;
  /**
   * Pass 130: the whole turn is lit instead of a span. Nothing is being judged,
   * so the flag draws in the ink named here rather than in a verdict colour.
   */
  lit?: boolean;
  stroke?: string;
  wash?: string;
  dashed?: boolean;
};

/** The dom id of a turn, so the rail can scroll to it. */
export function turnAnchorId(turnNo: number): string {
  return `verify-turn-${turnNo}`;
}

/** The badge in both headers. Drafts only, never rendered at zero. */
export function checkBadgeText(count: number): string {
  return `${count} TO CHECK`;
}

/** The same badge, for the decisions reader. One helper beside the other. */
export function reviewBadgeText(count: number): string {
  return `${count} TO REVIEW`;
}

/** Said once, when every item on the run has been settled. */
export const VERIFY_ALL_SETTLED_LINE = "Every item here is settled.";

/** Said once, when a previous run's settled item did not carry forward. */
export const VERIFY_CARRY_LINE = "Claims that changed since the last run come back to check.";

export const VERIFY_SOURCE_TITLE = "Verify it at the source";

export const VERIFY_SOURCE_NO_LINK =
  "No link came with this push. Open the conversation in the AI app you ran it in.";

export const VERIFY_SOURCE_STEPS: readonly string[] = [
  "1. Copy the prompt.",
  "2. Run it in the conversation that produced this work.",
  "3. Push the conversation to Lasso again and run this analysis again.",
];

export const VERIFY_SOURCE_WHY =
  "Checks done at the source land in the record, and the record is what makes the work defensible.";

const SOURCE_PROMPT_PROSE = `Re-verify each flagged claim below, one at a time. For every claim, state whether it holds, name the specific source that supports it, a publication, document, or dataset, with a date where possible, and show any calculation in full. If a claim cannot be verified against a source you can name, say plainly that it cannot be verified and what evidence would settle it. Do not soften the claims and do not restate them in new words. End with one line per claim: the claim, its status, and its source.

Claims to check:`;

/** The prose verbatim, then the remaining draft claims, numbered and verbatim. */
export function sourcePrompt(claims: readonly string[]): string {
  const numbered = claims.map((claim, index) => `${index + 1}. ${claim}`).join("\n");
  return numbered ? `${SOURCE_PROMPT_PROSE}\n${numbered}` : SOURCE_PROMPT_PROSE;
}

