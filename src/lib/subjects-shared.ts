/**
 * Pass 167. Subjects are the names the extract already read out of your work.
 * We keep what was read, and you decide what is true.
 */

/** How we know a chain link is real. Never written from prose. */
export const CHAIN_METHODS = ["same_conversation", "explicit_reference", "user_linked"] as const;
export type ChainMethod = (typeof CHAIN_METHODS)[number];

export const SUBJECT_SOURCES = ["extract", "confirmed", "rejected"] as const;
export type SubjectSource = (typeof SUBJECT_SOURCES)[number];

export const CURATE_ACTIONS = ["confirmed", "rejected", "merged", "unmerged"] as const;
export type CurateAction = (typeof CURATE_ACTIONS)[number];

export type Subject = {
  entity_key: string;
  entity_raw: string;
  source: SubjectSource;
  merged_into: string | null;
};

/** A reading of the model's handoff prose. A suggestion, never an edge. */
export type HandoffSuggestion = {
  work_item_id: string;
  title: string;
  handoff: string;
};

/**
 * What a person can act on. Rejected keys are excluded from matching, and a
 * key folded into another is no longer offered on its own.
 */
export function matchableSubjects(subjects: readonly Subject[]): Subject[] {
  return subjects.filter((s) => s.source !== "rejected" && !s.merged_into);
}

/** Alphabetical, always. Subjects are never ranked. */
export function sortSubjects(subjects: readonly Subject[]): Subject[] {
  return [...subjects].sort((a, b) => a.entity_key.localeCompare(b.entity_key));
}
