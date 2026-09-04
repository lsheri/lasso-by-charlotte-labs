/**
 * Pass 167. The one normalisation rule for a subject name, kept small, pure
 * and obvious on purpose.
 *
 * It trims, drops surrounding punctuation, collapses internal whitespace and
 * lowercases. It does nothing else. No stemming, no fuzzy matching, no edit
 * distance: "charlotte" and "charlotte labs" stay two different subjects
 * until a person says otherwise.
 */

/** Punctuation we strip from the ends of a name, never from the middle. */
const EDGE_PUNCTUATION = /^[\s"'“”‘’`(){}\[\].,;:!?/\\|*_-]+|[\s"'“”‘’`(){}\[\].,;:!?/\\|*_-]+$/g;

export function entityKey(raw: string): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(EDGE_PUNCTUATION, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** The extract stores subjects comma separated. Split, keep order, drop blanks. */
export function splitEntities(csv: string | null | undefined): string[] {
  if (!csv) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of csv.split(",")) {
    const raw = part.replace(EDGE_PUNCTUATION, "").replace(/\s+/g, " ").trim();
    const key = entityKey(raw);
    if (!raw || !key || seen.has(key)) continue;
    seen.add(key);
    out.push(raw);
  }
  return out;
}
