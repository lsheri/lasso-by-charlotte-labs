/**
 * Pass 155. Machine-generated model identifiers only.
 *
 * A model id string is not human text: it is emitted by the vendor's API and
 * carries nothing a person wrote. The raw string travels verbatim in
 * model_raw; this module answers the separate question of which stable family
 * it belongs to, so families can be compared over time as vendors rename
 * their snapshots. Data only, additive, never throws.
 */

export const MODEL_FAMILIES = [
  "gpt-3.5",
  "gpt-4",
  "gpt-4o",
  "gpt-4.1",
  "gpt-5",
  "o1",
  "o3",
  "o4",
  "claude-opus",
  "claude-sonnet",
  "claude-haiku",
  "gemini-pro",
  "gemini-flash",
  "grok",
  "llama",
  "mistral",
  "deepseek",
  "qwen",
  "command",
  "unrecognized",
  "undisclosed",
] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

/** When a client tells us nothing about the model. */
export const UNDISCLOSED = "undisclosed";

/**
 * Ordered longest-prefix-ish rules. First match wins, so the more specific
 * pattern is listed before the more general one.
 */
const RULES: [RegExp, ModelFamily][] = [
  [/^(openai\/)?gpt-?5/, "gpt-5"],
  [/^(openai\/)?gpt-?4\.1/, "gpt-4.1"],
  [/^(openai\/)?gpt-?4o/, "gpt-4o"],
  [/^(openai\/)?chatgpt-4o/, "gpt-4o"],
  [/^(openai\/)?gpt-?4/, "gpt-4"],
  [/^(openai\/)?gpt-?3\.5/, "gpt-3.5"],
  [/^(openai\/)?o1(\b|[-_.])/, "o1"],
  [/^(openai\/)?o3(\b|[-_.])/, "o3"],
  [/^(openai\/)?o4(\b|[-_.])/, "o4"],
  [/opus/, "claude-opus"],
  [/sonnet/, "claude-sonnet"],
  [/haiku/, "claude-haiku"],
  [/gemini.*flash/, "gemini-flash"],
  [/gemini.*(pro|ultra)/, "gemini-pro"],
  [/^gemini/, "gemini-pro"],
  [/grok/, "grok"],
  [/llama/, "llama"],
  [/mi(x|s)tral/, "mistral"],
  [/deepseek/, "deepseek"],
  [/qwen/, "qwen"],
  [/^command/, "command"],
];

/** Verbatim machine identifier, trimmed. Absent becomes "undisclosed". */
export function modelRawOf(raw: unknown): string {
  if (typeof raw !== "string") return UNDISCLOSED;
  const value = raw.trim();
  if (!value) return UNDISCLOSED;
  return value.slice(0, 120);
}

/** Stable family for a raw identifier. Unknown strings are "unrecognized". */
export function normalizeModelId(raw: unknown): ModelFamily {
  const value = modelRawOf(raw);
  if (value === UNDISCLOSED) return "undisclosed";
  const key = value.toLowerCase().replace(/^models\//, "");
  for (const [pattern, family] of RULES) {
    if (pattern.test(key)) return family;
  }
  return "unrecognized";
}

/** More than one distinct raw identifier inside one conversation. */
export function modelSwitched(raws: readonly unknown[]): boolean {
  const seen = new Set<string>();
  for (const raw of raws) {
    const value = modelRawOf(raw);
    if (value === UNDISCLOSED) continue;
    seen.add(value);
    if (seen.size > 1) return true;
  }
  return false;
}
