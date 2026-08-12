/**
 * Meeting-transcript detection for file connectors.
 *
 * This is a LABELLED GUESS, never a gate. A detected file is imported as a
 * call with 'transcribed' fidelity and shows a "Call transcript" chip in the
 * picker before import; the owner can change the type afterwards.
 */

const NAME_PATTERNS: RegExp[] = [
  /\btranscripts?\b/i,
  /\bmeeting recording\b/i,
  /\bmeeting notes\b/i,
  /\bnotes by gemini\b/i,
  /\bgemini notes\b/i,
  /\brecording\b/i,
  // Google Meet's own naming: "Title (2026-05-04 14:30 GMT-4) - Transcript"
  /\(\d{4}-\d{2}-\d{2}[^)]*\)\s*-\s*(transcript|notes|recording)/i,
  /\bcall notes\b/i,
  /\bzoom\b.*\b(transcript|recording)\b/i,
  /\bteams\b.*\b(transcript|recording)\b/i,
];

const FOLDER_PATTERNS: RegExp[] = [
  /\bmeet recordings\b/i,
  /\bmeeting recordings\b/i,
  /\brecordings\b/i,
  /\btranscripts\b/i,
];

export const TRANSCRIPT_HINT = "Call transcript";

/** True when a file looks like a meeting transcript by name or parent folder. */
export function looksLikeTranscript(
  name: string | null | undefined,
  folderName?: string | null,
): boolean {
  const title = (name ?? "").trim();
  if (title && NAME_PATTERNS.some((re) => re.test(title))) return true;
  const folder = (folderName ?? "").trim();
  return Boolean(folder) && FOLDER_PATTERNS.some((re) => re.test(folder));
}

export function transcriptHint(
  name: string | null | undefined,
  folderName?: string | null,
): string | null {
  return looksLikeTranscript(name, folderName) ? TRANSCRIPT_HINT : null;
}
