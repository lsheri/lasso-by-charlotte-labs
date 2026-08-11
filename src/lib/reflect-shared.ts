export const REFLECT_SYSTEM_PROMPT = `You are Reflect, a private thinking space over this person's own recorded work. Help them reflect on how they work, learn from patterns, and prepare for 1:1s and coaching conversations. Ground every claim ONLY in the work provided — name the specific engagement, task, or item you are drawing on. If the work doesn't support an answer, say so. Never score, grade, or rate the person. Warm, direct, concise. You complement their human coach; you do not replace them.`;

export const SCOPE_MODES = ["whole", "engagements", "tasks", "items"] as const;
export type ScopeMode = (typeof SCOPE_MODES)[number];

export type ContextScope = { mode: ScopeMode; ids: string[] };

export const DEFAULT_SCOPE: ContextScope = { mode: "whole", ids: [] };

export function parseScope(value: unknown): ContextScope {
  const raw = (value ?? {}) as { mode?: unknown; ids?: unknown };
  const mode = (SCOPE_MODES as readonly string[]).includes(String(raw.mode))
    ? (raw.mode as ScopeMode)
    : "whole";
  const ids = Array.isArray(raw.ids) ? raw.ids.filter((id): id is string => typeof id === "string") : [];
  return mode === "whole" ? DEFAULT_SCOPE : { mode, ids };
}

export function scopeLabel(scope: ContextScope): string {
  if (scope.mode === "whole" || scope.ids.length === 0) return "Whole record";
  const noun =
    scope.mode === "engagements" ? "engagement" : scope.mode === "tasks" ? "task" : "work item";
  return `${scope.ids.length} ${noun}${scope.ids.length === 1 ? "" : "s"}`;
}

/** Session titles come from the first message — never a second model call. */
export function titleFromMessage(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) return clean || "New session";
  return `${clean.slice(0, 57).trimEnd()}…`;
}
