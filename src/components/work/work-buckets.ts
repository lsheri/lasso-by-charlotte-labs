import {
  isConversationGroup,
  type ConversationGroup,
  type WorkItemRow,
  type WorkType,
} from "@/lib/work-types";

/**
 * Four columns and only four. AI conversations leads, because that is where
 * the work starts now and it is the column a person scans first; documents,
 * models and sheets, then call transcripts follow. This order is a founder
 * decision of 13 Sep 2026 and deliberately departs from Figma 22:220, which
 * led with DOCUMENTS.
 *
 * Two things changed from the earlier matrix to match the frame. A spreadsheet
 * now gets its own column instead of folding into Documents, because a model is
 * a different kind of artifact from a memo and the frame treats it that way. A
 * deck folds INTO Documents, because the frame files "Diligence readout v3.pptx"
 * there rather than giving presentations a column of its own.
 *
 * Types with no column of their own (mail, messages, images) still fold into
 * Documents: the grouping coarsens, the row does not, because every row keeps
 * its own precise label and glyph from workIdentity.
 */
export type BucketKey = "documents" | "sheets" | "calls" | "llm";

export type Bucket = {
  key: BucketKey;
  label: string;
  /** Every badge carries a letter, so colour is never the only signal. */
  letter: string;
  /** Data, not chrome: the badge fill. */
  color: string;
  /** Text-safe variant of the fill for labels on paper. */
  textColor: string;
};

/**
 * The four badges are graded ink rather than four hues. The frame gives these
 * columns no colour at all, and the app's colour vocabulary is spoken for:
 * amber means "waiting on you" and green means "on the record". Borrowing
 * either one for a file type would say something untrue about the work.
 */
export const BUCKETS: Bucket[] = [
  {
    key: "llm",
    label: "AI conversations",
    letter: "A",
    color: "var(--nb-mid)",
    textColor: "var(--nb-mid)",
  },
  {
    key: "documents",
    label: "Documents",
    letter: "D",
    color: "var(--nb-ink)",
    textColor: "var(--nb-ink)",
  },
  {
    key: "sheets",
    label: "Models & sheets",
    letter: "M",
    color: "var(--nb-graphite)",
    textColor: "var(--nb-graphite)",
  },
  {
    key: "calls",
    label: "Meeting transcripts",
    letter: "C",
    color: "var(--nb-mid)",
    textColor: "var(--nb-mid)",
  },
];

const BY_TYPE: Record<WorkType, BucketKey> = {
  ai_thread: "llm",
  deck: "documents",
  call: "calls",
  document: "documents",
  sheet: "sheets",
  email: "documents",
  message: "documents",
  image: "documents",
};

export function bucketFor(type: WorkType): Bucket {
  const key = BY_TYPE[type] ?? "documents";
  return BUCKETS.find((b) => b.key === key) ?? BUCKETS[0]!;
}
/**
 * P1: group beats bucket. A pushed conversation is filed under AI
 * conversations whatever its artifacts are typed as, so a single push is never
 * torn across two columns.
 */
export function bucketKeyForEntry(entry: WorkItemRow | ConversationGroup): BucketKey {
  return isConversationGroup(entry) ? "llm" : bucketFor(entry.type).key;
}
