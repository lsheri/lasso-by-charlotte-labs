/** Quote verification: did the model quote something that is actually there? */

const MIN_QUOTE_CHARS = 40;

function normalise(value: string): string {
  return value
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201F\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Every COMPLETE quoted span longer than the floor. A dangling opening quote
 * with no partner, which is what a cut-off answer leaves behind, is ignored:
 * the verifier must never fire on our own truncation.
 */
export function longQuotes(answer: string): string[] {
  const found: string[] = [];
  const patterns = [/"([^"\n]*)"/g, /\u201C([^\u201D]*)\u201D/g];
  for (const pattern of patterns) {
    for (const match of answer.matchAll(pattern)) {
      const span = (match[1] ?? "").trim();
      if (span.length >= MIN_QUOTE_CHARS) found.push(span);
    }
  }
  return found;
}

/**
 * Quoted spans that do not appear in the context that was supplied. When the
 * answer itself was cut short, no check on it is meaningful, so none is made.
 */
export function unmatchedQuotes(answer: string, context: string, cutOff = false): string[] {
  if (cutOff) return [];
  const haystack = normalise(context);
  return longQuotes(answer).filter((quote) => !haystack.includes(normalise(quote)));
}

/** Content-free bucket for telemetry. */
export function quoteBucket(count: number): "0" | "1" | "2+" {
  if (count <= 0) return "0";
  if (count === 1) return "1";
  return "2+";
}

/** Names what was not found, rather than warning in general. */
export function unmatchedQuoteNote(count: number): string {
  const subject = count === 1 ? "One quote" : `${count} quotes`;
  const verb = count === 1 ? "could not be found" : "could not be found";
  return `${subject} in this answer ${verb} in your stored work. Open What I read for this answer to check.`;
}

export const CUT_OFF_NOTE =
  "This answer was cut off before it finished. Ask a narrower question, or ask me to continue.";
