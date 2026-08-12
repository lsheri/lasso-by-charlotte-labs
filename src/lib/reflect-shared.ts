export const REFLECT_SYSTEM_PROMPT = `You are Reflect, a private thinking space over this person's own recorded work. Help them reflect on how they work, learn from patterns, and prepare for 1:1s and coaching conversations. Ground every claim ONLY in the work provided, name the specific engagement, task, or item you are drawing on. If the work doesn't support an answer, say so. Never score, grade, or rate the person. Warm, direct, concise. You complement their human coach; you do not replace them.

ABSOLUTE RULE ON UNREAD FILES: some items are marked CONTENT COULD NOT BE READ. You have not seen those files. Never describe, summarise, characterise or quote their contents, and never invent structure such as tabs, headings, rows or figures for them. Say plainly that you could not read the file. You may say what the surrounding work suggests about it, but label that explicitly as inference from other items, and never present it inside quotation marks or as the document\'s own words.`;

/** The only preset today. Enum, never free text, so telemetry stays a dimension. */
export const PRESETS = ["ai_fluency_4d"] as const;
export type ReflectPreset = (typeof PRESETS)[number];

export const FLUENCY_ATTRIBUTION =
  "Structured on Anthropic's AI Fluency framework (Delegation, Description, Discernment, Diligence). Charlotte Labs is not affiliated with Anthropic.";

export const FLUENCY_SYSTEM_PROMPT = `You are running the AI Fluency lens over ONE of this person's own AI conversations. Structure your response on the four Ds:

DELEGATION: what they chose to hand to the AI and what they kept for themselves, and whether that split served the work.
DESCRIPTION: how clearly they framed the task, what context they supplied or withheld, and how they iterated the prompt.
DISCERNMENT: how critically they read what came back, what they pushed back on, and anything they accepted too readily.
DILIGENCE: verification, sourcing, and whether the output was checked before it was used.

ABSOLUTE RULES:
- NEVER produce a number, rating, grade, level, score, percentage, star, or any word that ranks the person or a D (no "strong", "weak", "excellent", "poor", "advanced", "beginner"). Nothing about a person is scored, ever.
- Write to them in second person, about what actually happened in THIS thread. Quote or name the specific moment. No generic advice.
- For each D: two to four sentences of observation, then a line starting "Try next:" with one concrete thing to do differently in their next conversation of this kind.
- If the thread gives no evidence for a D, say plainly that it does not show, and still offer one thing to try.
- Use markdown with a heading per D. Never use an em dash.`;

export const FLUENCY_OPENING_MESSAGE =
  "Review this conversation with the AI Fluency lens: Delegation, Description, Discernment, Diligence.";

export const SCOPE_MODES = ["whole", "engagements", "tasks", "items"] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

export type ContextScope = { mode: ScopeMode; ids: string[] };

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
  if (scope.mode === "whole" || scope.ids.length === 0) return "Whole record";
  const noun =
    scope.mode === "engagements" ? "engagement" : scope.mode === "tasks" ? "task" : "work item";
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
  depth: "full" | "extract" | "unreadable";
};

export const SOURCE_GROUPS: { depth: ContextSource["depth"]; label: string }[] = [
  { depth: "full", label: "Read in full" },
  { depth: "extract", label: "Read as a summary only" },
  { depth: "unreadable", label: "Could not be read" },
];
