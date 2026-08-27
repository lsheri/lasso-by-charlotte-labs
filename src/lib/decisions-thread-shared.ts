/**
 * PASS 130 — "What got decided", thread scoped.
 *
 * The display language of the thread scoped decisions reader: the heading, the
 * origin chips, the order the rail reads, and the one annotation line a changed
 * call carries. Nothing here reads the record, and nothing here judges anybody:
 * there are no counts, no totals, no ratios and no balance sentence, by design.
 */

import type { DecisionCandidateItem, DecisionOriginClass, HandoffItem } from "@/lib/handoffs-shared";

export const DECISIONS_RAIL_HEADING = "DECISIONS TO CONFIRM FIRST";

/** A run that finds no consequential call is a true result, said in full. */
export const DECISIONS_EMPTY_LINE =
  "NOTHING IN THIS CONVERSATION READS AS A CALL THAT SHAPED THE WORK.";

/** The quiet footer row, for calls with nowhere to point. */
export const DECISIONS_UNTRACEABLE_LINE = "Could not be traced to a turn or the brief.";

/** The only annotation any item carries, and only when the call changed. */
export const DECISIONS_CHANGED_LINE = "Changed in the record before it landed.";

/** One chip per item. Where it came from, in plain words. */
export const ORIGIN_CHIP: Record<DecisionOriginClass, string> = {
  you: "You brought",
  model_accepted: "The model introduced",
  model_changed: "The model introduced",
  brief: "From the brief",
  source: "From a source",
  untraceable: "",
};

/** Absent reads as untraceable. It is never a reason to drop an item. */
export function originClass(fields: DecisionCandidateItem): DecisionOriginClass {
  return fields.origin_class ?? "untraceable";
}

const RANK: Record<DecisionOriginClass, number> = {
  model_accepted: 0,
  model_changed: 1,
  you: 2,
  brief: 3,
  source: 4,
  untraceable: 5,
};

/** Rail order, stable: what the model brought first, then what you brought. */
export function orderDecisions<T extends { fields: DecisionCandidateItem }>(
  items: readonly T[],
): T[] {
  return [...items]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const rank = RANK[originClass(a.item.fields)] - RANK[originClass(b.item.fields)];
      return rank !== 0 ? rank : a.index - b.index;
    })
    .map((entry) => entry.item);
}

/** Live decisions on a run: drafts and confirmed, only ones with an anchor. */
export function decisionFindings(items: readonly HandoffItem[]): (HandoffItem & {
  fields: DecisionCandidateItem;
})[] {
  return orderDecisions(
    items.filter(
      (item): item is HandoffItem & { fields: DecisionCandidateItem } =>
        item.state !== "discarded" &&
        typeof (item.fields as DecisionCandidateItem).call === "string" &&
        typeof (item.fields as DecisionCandidateItem).evidence_turn_id === "string",
    ),
  );
}

/** Said once, when every call on the run has been settled. */
export const DECISIONS_ALL_SETTLED_LINE = "Every call here is settled.";

export const DECISIONS_CONFIRM_LABEL = "Confirm";
export const DECISIONS_DISCARD_LABEL = "Not needed";
