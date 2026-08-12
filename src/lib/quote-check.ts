/** Quote verification: did the model quote something that is actually there? */

const MIN_QUOTE_CHARS = 40;

function normalise(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Every quoted span longer than the floor, straight or curly, single or double. */
export function longQuotes(answer: string): string[] {
  const found: string[] = [];
  const patterns = [/"([^"]{40,})"/g, /\u201C([^\u201D]{40,})\u201D/g];
  for (const pattern of patterns) {
    for (const match of answer.matchAll(pattern)) {
      const span = (match[1] ?? "").trim();
      if (span.length >= MIN_QUOTE_CHARS) found.push(span);
    }
  }
  return found;
}

/** Quoted spans that do not appear in the context that was supplied. */
export function unmatchedQuotes(answer: string, context: string): string[] {
  const haystack = normalise(context);
  return longQuotes(answer).filter((quote) => !haystack.includes(normalise(quote)));
}

/** Content-free bucket for telemetry. */
export function quoteBucket(count: number): "0" | "1" | "2+" {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  return "2+";
}

export const UNMATCHED_QUOTE_NOTE =
  "One or more quotes in this answer could not be matched to your stored work. Open the sources above to check.";
