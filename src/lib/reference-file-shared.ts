/** P1b. Shared words and rules for a file placeholder the chat created. */

export type ReferenceMatch = "yes" | "no" | "unknown";
export type ReferenceVia = "drop" | "drive";

/** yes when the chat's sha256 equals the file added, no when it differs, unknown when none was sent. */
export function referenceMatch(
  statedSha: string | null | undefined,
  computedSha: string,
): ReferenceMatch {
  const stated = typeof statedSha === "string" ? statedSha.trim().toLowerCase() : "";
  if (!stated) return "unknown";
  return stated === computedSha.toLowerCase() ? "yes" : "no";
}

export const REFERENCE_INBOX_STATUS = "Arrived. File not yet added.";
export const REFERENCE_MADE_IN_CHAT = "Made in this chat";
export const REFERENCE_ADD_LABEL = "Add the file";
export const REFERENCE_MATCH_YES = "Verified against the chat";
export const REFERENCE_MATCH_NO = "Different from the version the chat produced";

export function isReferenceItem(item: { content_fidelity?: string | null | undefined } | null | undefined): boolean {
  return item?.content_fidelity === "reference";
}
