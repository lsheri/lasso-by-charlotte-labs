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

export const REFERENCE_DRIVE_LABEL = "From Drive";
export const REFERENCE_DRIVE_CONFIRM = "Use this file";

const GOOGLE_NATIVE_PREFIX = "application/vnd.google-apps";

export function isGoogleNative(mime: string | null | undefined): boolean {
  return typeof mime === "string" && mime.startsWith(GOOGLE_NATIVE_PREFIX);
}

/** C2: a Google-native file exports to the placeholder's own format. */
export function placeholderExportTarget(nativeMime: string): { mime: string; ext: string } {
  switch (nativeMime) {
    case "application/vnd.google-apps.presentation":
      return {
        mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ext: "pptx",
      };
    case "application/vnd.google-apps.document":
      return {
        mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ext: "docx",
      };
    case "application/vnd.google-apps.spreadsheet":
      return { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ext: "xlsx" };
    default:
      return { mime: "application/pdf", ext: "pdf" };
  }
}

/** An export can never be byte-identical to the chat's file, so its match is always unknown. */
export function driveReferenceMatch(
  statedSha: string | null | undefined,
  computedSha: string,
  exported: boolean,
): ReferenceMatch {
  return exported ? "unknown" : referenceMatch(statedSha, computedSha);
}

/** C2: single-pick keeps at most one file; import mode toggles as before. */
export function nextPickSelection(prev: Set<string>, id: string, single: boolean): Set<string> {
  if (single) return prev.has(id) ? new Set() : new Set([id]);
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
