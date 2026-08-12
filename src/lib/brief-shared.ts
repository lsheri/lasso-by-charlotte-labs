/**
 * A brief is the document that says what the work was supposed to be. It is
 * marked by the owner on a normal work item, so nothing about capture, consent
 * or visibility changes: only how the record reads it.
 */

export type BriefScopeType = "engagement" | "task";
export type BriefScope = { type: BriefScopeType; id: string };

/** The two keys a brief adds to work_items.meta. Nothing else is written. */
export type BriefMeta = { role?: string | null; brief_scope?: BriefScope | null };

/** Exact header the assembler emits above every brief. */
export const BRIEF_HEADER = "THE BRIEF (what this work was asked to do):";

/** Exact wording used when no brief covers the scope being assembled. */
export const NO_BRIEF_LINE =
  "NO BRIEF WAS PROVIDED for this work. Nothing in this record states what the work was asked to do. Every finding below is therefore relative to the conversation and the artifacts alone. Never infer, guess or describe what a brief probably said.";

/** A single brief is capped here, head and tail, and says so when cut. */
export const BRIEF_CAP = 40_000;
export const BRIEF_HEAD_CHARS = 8_000;
export const BRIEF_TAIL_CHARS = 32_000;
export const BRIEF_OMITTED_MARKER = "[... middle of the brief omitted, it is unusually long ...]";

/** Shared prompt clause. Every AI surface that can see a brief carries it. */
export const BRIEF_PROMPT_RULES = `THE BRIEF:
- If the context opens with a block headed "${BRIEF_HEADER}", that document is what the work was asked to do. Read it first and judge everything else against it.
- If the context says no brief was provided, state that plainly in your answer and make clear your findings are relative to the conversation and artifacts alone. Never infer what a brief probably said.`;

export function briefScopeOf(meta: unknown): BriefScope | null {
  const value = (meta ?? null) as BriefMeta | null;
  if (!value || value.role !== "brief") return null;
  const scope = value.brief_scope;
  if (!scope || (scope.type !== "engagement" && scope.type !== "task") || !scope.id) return null;
  return { type: scope.type, id: scope.id };
}

export function isBriefItem(item: { meta?: unknown } | null | undefined): boolean {
  return briefScopeOf(item?.meta) !== null;
}

/** Head and tail, because a brief's closing constraints matter as much as its opening. */
export function clipBrief(text: string): { text: string; cut: boolean } {
  if (text.length <= BRIEF_CAP) return { text, cut: false };
  return {
    text: `${text.slice(0, BRIEF_HEAD_CHARS)}\n\n${BRIEF_OMITTED_MARKER}\n\n${text.slice(-BRIEF_TAIL_CHARS)}`,
    cut: true,
  };
}
