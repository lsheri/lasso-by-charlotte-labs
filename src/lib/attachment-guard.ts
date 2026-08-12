/**
 * A push should carry the work, not the assistant's account of the work. An
 * attachment that is already sitting inside the transcript is a restatement,
 * not a separate artifact, so we flag it and let the owner decide.
 */

const SHINGLE = 8;
/** A large majority of the attachment already present in the transcript. */
export const DUPLICATE_THRESHOLD = 0.8;

function normalise(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[`*_>#|~\-[\]()]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function shingles(words: string[], size: number): string[] {
  if (words.length <= size) return words.length > 0 ? [words.join(" ")] : [];
  const out: string[] = [];
  for (let i = 0; i + size <= words.length; i += 1) out.push(words.slice(i, i + size).join(" "));
  return out;
}

/** Fraction of the attachment's word runs that already appear in the transcript. */
export function transcriptOverlap(content: string, transcript: string): number {
  const attachmentWords = normalise(content);
  if (attachmentWords.length === 0) return 0;
  const transcriptWords = normalise(transcript);
  if (transcriptWords.length === 0) return 0;

  const haystack = new Set(shingles(transcriptWords, SHINGLE));
  const needles = shingles(attachmentWords, SHINGLE);
  if (needles.length === 0) return 0;
  if (attachmentWords.length <= SHINGLE) {
    return transcriptWords.join(" ").includes(attachmentWords.join(" ")) ? 1 : 0;
  }
  let hits = 0;
  for (const needle of needles) if (haystack.has(needle)) hits += 1;
  return hits / needles.length;
}

export function looksLikeRestatement(content: string, transcript: string): boolean {
  return transcriptOverlap(content, transcript) >= DUPLICATE_THRESHOLD;
}

/** Content-free size band for telemetry. */
export function flaggedBucket(n: number): "0" | "1-2" | "3+" {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  return "3+";
}
