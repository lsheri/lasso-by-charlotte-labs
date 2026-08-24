/**
 * One colour language for a stitch, shared by the chip, the span highlight and
 * the thread so a person reads the same status in three places. The classes
 * only carry tokens: the values live in the token layer, never at point of use.
 */

import type { SpanStatus } from "@/lib/span-provenance-shared";

/** The status wrapper class. Everything else keys off the tokens it sets. */
export function spanStatusClass(status: SpanStatus): string {
  if (status === "exact") return "nb-span nb-span-exact";
  if (status === "paraphrase") return "nb-span nb-span-paraphrase";
  return "nb-span nb-span-unsourced";
}

/** The stroke a thread or an outline draws in for this status. */
export function spanStatusStroke(status: SpanStatus): string {
  if (status === "exact") return "var(--status-exact)";
  if (status === "paraphrase") return "var(--status-paraphrase)";
  return "var(--status-unsourced)";
}

/** The soft wash behind a highlighted span for this status. */
export function spanStatusWash(status: SpanStatus): string {
  if (status === "exact") return "var(--status-exact-wash)";
  if (status === "paraphrase") return "var(--status-paraphrase-wash)";
  return "var(--status-unsourced-wash)";
}
