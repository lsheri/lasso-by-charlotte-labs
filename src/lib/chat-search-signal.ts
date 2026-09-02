/**
 * Pass 157b: the chat library search signal, pure half.
 *
 * Bands only in dims. The words a person typed live in the payload, which the
 * existing egress mapping releases at work-details level and up and nowhere
 * else.
 */

/** How long a query must sit still before it counts as a real search. */
export const CHAT_SEARCH_DEBOUNCE_MS = 1500;

/** Below this a query is still someone typing. */
export const CHAT_SEARCH_MIN_CHARS = 2;

export type QueryLenBand = "1-10" | "11-30" | "31-80" | "80+";
export type ResultBand = "0" | "1-5" | "6-20" | "21+";

export function queryLenBand(length: number): QueryLenBand {
  if (length <= 10) return "1-10";
  if (length <= 30) return "11-30";
  if (length <= 80) return "31-80";
  return "80+";
}

export function resultBand(count: number): ResultBand {
  if (count <= 0) return "0";
  if (count <= 5) return "1-5";
  if (count <= 20) return "6-20";
  return "21+";
}

/** A query worth recording at all. */
export function isSettledQuery(query: string): boolean {
  return query.trim().length >= CHAT_SEARCH_MIN_CHARS;
}
