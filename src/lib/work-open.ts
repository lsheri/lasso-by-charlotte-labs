import { effectiveChatUrl } from "@/lib/chat-url";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * W1 — what "Open" means, decided in one place.
 *
 * A person who opens a pushed conversation expects to land back in the chat it
 * came from. Failing that, they expect to read it here. Saving a file was never
 * what the word meant, so it is not one of the answers.
 */
export type WorkOpenPlan =
  /** A real conversation URL exists, so Open leaves for the source app. */
  | { kind: "source"; url: string }
  /** A stored file exists, so Open shows it, in the browser, never saved down. */
  | { kind: "file" }
  /** Nothing to leave for, so Open reads it here. */
  | { kind: "reader" };

export function resolveWorkOpen(item: WorkItemRow | null | undefined): WorkOpenPlan {
  const url = effectiveChatUrl(
    item?.source_meta?.url,
    item?.source_vendor ?? null,
    item?.orig_conversation_id ?? null,
  );
  if (url) return { kind: "source", url };
  if (item?.content_ref) return { kind: "file" };
  return { kind: "reader" };
}

/** True when the card can honestly offer a way back to where the work happened. */
export function canOpenAtSource(item: WorkItemRow | null | undefined): boolean {
  return resolveWorkOpen(item).kind === "source";
}

/** A few plain words for a card that cannot go back to its source. */
export const NO_SOURCE_LINK_LABEL = "Kept in full";

/** What remains readable here when there is no honest route back to its source. */
export function keptContentLabel(
  item: Pick<WorkItemRow, "content_fidelity" | "type"> | null | undefined,
  turnCount?: number | null,
): string {
  if (item?.content_fidelity === "summary") return "Summary kept";
  if (item?.content_fidelity === "reference") return "File reference kept";
  if (item?.type === "ai_thread" && typeof turnCount === "number" && turnCount > 0) {
    return `${turnCount} ${turnCount === 1 ? "turn" : "turns"} kept in full`;
  }
  return NO_SOURCE_LINK_LABEL;
}
