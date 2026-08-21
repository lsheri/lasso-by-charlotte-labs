import type { WorkType } from "@/lib/work-types";

/**
 * The type matrix has four buckets and only four. Types that have no bucket of
 * their own (sheets, mail, messages, images) fold into Documents: the grouping
 * coarsens, the row does not, because every row still shows its own precise
 * label and glyph from workIdentity.
 */
export type BucketKey = "documents" | "presentations" | "calls" | "llm";

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

export const BUCKETS: Bucket[] = [
  {
    key: "documents",
    label: "Documents",
    letter: "D",
    color: "#1d6fe0",
    textColor: "#1d6fe0",
  },
  {
    key: "presentations",
    label: "Presentations",
    letter: "P",
    color: "#e8a11b",
    textColor: "#a06a03",
  },
  {
    key: "calls",
    label: "Call transcripts",
    letter: "C",
    color: "#111413",
    textColor: "#111413",
  },
  {
    key: "llm",
    label: "LLM transcripts",
    letter: "L",
    color: "#12653d",
    textColor: "#12653d",
  },
];

const BY_TYPE: Record<WorkType, BucketKey> = {
  ai_thread: "llm",
  deck: "presentations",
  call: "calls",
  document: "documents",
  sheet: "documents",
  email: "documents",
  message: "documents",
  image: "documents",
};

export function bucketFor(type: WorkType): Bucket {
  const key = BY_TYPE[type] ?? "documents";
  return BUCKETS.find((b) => b.key === key) ?? BUCKETS[0]!;
}
