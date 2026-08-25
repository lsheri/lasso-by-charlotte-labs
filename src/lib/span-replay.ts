/**
 * The replay half of the lasso loop, kept pure so the choreography can be read
 * and tested without a browser: which answer just landed, what a person sees on
 * a tab, and what happens the moment an answer resolves.
 */
import type { AuditStitch } from "@/lib/span-provenance.functions";
import { normalizeSnippet } from "@/lib/span-provenance-shared";

/** How much of the circled wording a tab shows before it trails off. */
export const TAB_LABEL_CHARS = 28;

export function stitchTabLabel(stitch: {
  locator?: { snippet?: string } | null;
  question?: string | null;
}): string {
  const text = (stitch.locator?.snippet ?? stitch.question ?? "").trim();
  if (text.length === 0) return "Untitled question";
  return text.length > TAB_LABEL_CHARS ? `${text.slice(0, TAB_LABEL_CHARS)}…` : text;
}

/**
 * The whole circled wording, for surfaces with room to breathe: the rail lets
 * CSS decide where a label stops, and the confirm says it in full.
 */
export function stitchTabFullLabel(stitch: {
  locator?: { snippet?: string } | null;
  question?: string | null;
}): string {
  const text = (stitch.locator?.snippet ?? stitch.question ?? "").trim();
  return text.length === 0 ? "Untitled question" : text;
}

/** The rail is a history, so the newest question sits at the front. */
export function tabsNewestFirst<T extends { created_at: string }>(stitches: T[]): T[] {
  return [...stitches].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** The answer that just landed for this wording: the newest one that matches. */
export function pickResolvedStitch(
  stitches: AuditStitch[],
  snippet: string,
): AuditStitch | null {
  const wanted = normalizeSnippet(snippet);
  const matches = stitches.filter(
    (stitch) => normalizeSnippet(stitch.locator?.snippet ?? "") === wanted,
  );
  return tabsNewestFirst(matches)[0] ?? null;
}

/** Sourced answers open their source. An unsourced one has nothing to open. */
export function shouldAutoOpen(stitch: Pick<AuditStitch, "to_item_id">): boolean {
  return Boolean(stitch.to_item_id);
}

/**
 * Draw the thread, then open the source when there genuinely is one. The order
 * is the point: the reveal is never allowed to run ahead of the answer.
 */
export function runResolveChoreography(
  stitch: AuditStitch,
  handlers: { onThread: (stitch: AuditStitch) => void; onFocus: (stitch: AuditStitch) => void },
): void {
  handlers.onThread(stitch);
  if (shouldAutoOpen(stitch)) handlers.onFocus(stitch);
}
