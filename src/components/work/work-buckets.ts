import type { WorkType } from "@/lib/work-types";

/**
 * Figma 22:220 gives the pile four columns and only four: DOCUMENTS,
 * MODELS & SHEETS, CALL TRANSCRIPTS, AI CONVERSATIONS.
 *
 * Two things changed from the earlier matrix to match the frame. A spreadsheet
 * now gets its own column instead of folding into Documents, because a model is
 * a different kind of artifact from a memo and the frame treats it that way. A
 * deck folds INTO Documents, because the frame files "Diligence readout v3.pptx"
 * there rather than giving presentations a column of their own.
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
    label: "Call transcripts",
    letter: "C",
    color: "var(--nb-mid)",
    textColor: "var(--nb-mid)",
  },
  {
    key: "llm",
    label: "AI conversations",
    letter: "A",
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