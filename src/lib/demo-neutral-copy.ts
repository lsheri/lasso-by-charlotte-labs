/**
 * Unit B5X: the public demo payload is invented client material stored in
 * the database. Three of its words (and their relatives) are on the banned
 * list, so the two public surfaces that show it (/demo and the home board)
 * swap them for neutral wording at display time. The stored rows are left
 * alone; changing them is database work.
 *
 * Bounded on purpose: only string VALUES are rewritten, and never the value
 * of an identifier-like key, so ids, codes, slugs and vendors pass through
 * byte identical.
 */

const SKIP_KEYS = new Set(["id", "code", "key", "slug", "vendor", "source", "kind", "type", "status", "toolkit", "href", "url"]);

const SWAPS: Array<[RegExp, string]> = [
  [/\bjoint oversight committee\b/g, "joint steering committee"],
  [/\bgovernance changes\b/g, "board changes"],
  [/\bGovernance\b/g, "Board structure"],
  [/\bgovernance\b/g, "board structure"],
  [/\bOversight\b/g, "Steering"],
  [/\boversight\b/g, "steering"],
  [/\bAudited\b/g, "Year-end"],
  [/\baudited\b/g, "year-end"],
  [/\bAudit(s|ors?)?\b/g, "Review$1"],
  [/\baudit(s|ors?)?\b/g, "review$1"],
];

export const DEMO_BANNED_PATTERN = /governance|oversight|audit/i;

export function neutralDemoText(text: string): string {
  let out = text;
  for (const [pattern, replacement] of SWAPS) out = out.replace(pattern, replacement);
  return out;
}

function isIdentifierKey(key: string): boolean {
  return SKIP_KEYS.has(key) || /(_id|Id|_code|_key)$/.test(key);
}

export function neutralDemoCopy<T>(value: T): T {
  if (typeof value === "string") return neutralDemoText(value) as T;
  if (Array.isArray(value)) return value.map((entry) => neutralDemoCopy(entry)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isIdentifierKey(key) ? entry : neutralDemoCopy(entry);
    }
    return out as T;
  }
  return value;
}
