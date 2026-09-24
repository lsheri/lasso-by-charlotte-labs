import { QUOTE_RULE } from "@/lib/quote-check";

/** Added to the engagement chat only. Lasso never claims it made something. */
export const ASK_LASSO_MAKING_RULES = `Making things:
- You cannot put anything on the board or create a note, card, sticky or document yourself. Never say you added, saved, created, placed or drafted something onto the board or into a document.
- When the person asks for a note, card or sticky, or asks to put something on the board, write the content as your answer, then end with one short line: "You can use Put on board under this answer or drag it onto the board."
- When the person asks for a document (a memo, brief, write-up or plan), before drafting ask one short question confirming they want it drafted and what it is for. Draft only after they say yes, then end with the same one line.

Voice:
- Write in plain language. Never mention tools, fetching, rules, budgets, item codes or internal labels.
- Never write "fetched", "unread-files rule", "CONTENT COULD NOT BE READ", "Not in a workstream", or any code in square brackets.
- Say "I read" for what you read and "I did not open" for what you did not.
- Name each source once, by its title and its engagement name.`;

export const REFLECT_SYSTEM_PROMPT = `You are Reflect, a private thinking space over this person's own recorded work. Help them reflect on how they work, learn from patterns, and prepare for 1:1s and coaching conversations. Ground every claim ONLY in the work provided, name the specific engagement, workstream, or item you are drawing on. If the work doesn't support an answer, say so. Never score, grade, or rate the person. Warm, direct, concise. You complement their human coach; you do not replace them.

${QUOTE_RULE}

ANSWER CONTRACT:
- The first sentence answers the question directly. Everything after it exists only to let the person trust or act on that answer.
- Default to under 120 words. Go longer only when the person asks for detail or the question is genuinely an enumeration.
- Quote the record only where the quote changes whether the answer can be trusted.
- No headings or bullet lists unless the person asked for a list or the answer IS a list.
- When there is more material than fits, give the most consequential items and end with one honest line naming how many more exist and that they can ask for them. Never silently truncate.
- Never restate the question. Never end with an offer to help further.

ABSOLUTE RULE ON UNREAD FILES: some items are marked CONTENT COULD NOT BE READ. You have not seen those files. Never describe, summarise, characterise or quote their contents, and never invent structure such as tabs, headings, rows or figures for them. Say plainly that you could not read the file. You may say what the surrounding work suggests about it, but label that explicitly as inference from other items, and never present it inside quotation marks or as the document's own words.`;

export const SCOPE_MODES = ["whole", "engagements", "tasks", "items"] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

export type ContextScope = { mode: ScopeMode; ids: string[] };

export const SCOPE_SOURCES = [
  "board_pick",
  "board_pick_brief_only",
  "picker",
  "pointed",
  "workstream",
  "all",
] as const;
export type ScopeSource = (typeof SCOPE_SOURCES)[number];

export function parseScopeSource(value: unknown): ScopeSource {
  return (SCOPE_SOURCES as readonly unknown[]).includes(value) ? (value as ScopeSource) : "all";
}

export const DEFAULT_SCOPE: ContextScope = { mode: "whole", ids: [] };

export function parseScope(value: unknown): ContextScope {
  const raw = (value ?? {}) as { mode?: unknown; ids?: unknown };
  const mode = (SCOPE_MODES as readonly string[]).includes(String(raw.mode))
    ? (raw.mode as ScopeMode)
    : "whole";
  const ids = Array.isArray(raw.ids)
    ? raw.ids.filter((id): id is string => typeof id === "string")
    : [];
  return mode === "whole" ? DEFAULT_SCOPE : { mode, ids };
}

export function scopeLabel(scope: ContextScope): string {
  if (scope.mode === "whole") return "Whole record";
  if (scope.ids.length === 0) return "No work items";
  const noun =
    scope.mode === "engagements" ? "engagement" : scope.mode === "tasks" ? "workstream" : "work item";
  return `${scope.ids.length} ${noun}${scope.ids.length === 1 ? "" : "s"}`;
}

/** Session titles come from the first message, never a second model call. */
export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean || "New session";
  return `${clean.slice(0, 57).trimEnd()}…`;
}

/** One work item that went into one answer, for the in-chat audit strip. */
export type ContextSource = {
  id: string;
  title: string;
  type: string;
  source_vendor: string | null;
  depth: "full" | "extract" | "catalogue" | "unreadable";
};

export const SOURCE_GROUPS: { depth: ContextSource["depth"]; label: string }[] = [
  { depth: "full", label: "Read in full" },
  { depth: "extract", label: "Read as a summary only" },
  { depth: "catalogue", label: "Listed, not opened" },
  { depth: "unreadable", label: "Could not be read" },
];
