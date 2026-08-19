/**
 * The single truth for "did Lasso ever read this file's contents", carried on
 * work_items.meta.text_status and written only by the extraction layer.
 * Absence means nothing has been attempted yet.
 */
export type TextStatus = "ok" | "unsupported" | "unreadable" | "failed" | "not_attempted";

type MetaLike = { text_status?: string | null; text_note?: string | null; text_error?: string | null } | null | undefined;

/** Older rows carry "empty"; it means the same thing as "unreadable". */
export function textStatusOf(meta: MetaLike): TextStatus {
  const raw = meta?.text_status ?? null;
  if (!raw) return "not_attempted";
  if (raw === "empty") return "unreadable";
  if (raw === "ok" || raw === "unsupported" || raw === "unreadable" || raw === "failed") return raw;
  return "not_attempted";
}

/** True when we know for a fact the contents were not read. */
export function contentsUnread(meta: MetaLike): boolean {
  const status = textStatusOf(meta);
  return status === "unsupported" || status === "unreadable" || status === "failed";
}

export const UNREAD_MARKER_LINE = "Lasso could not read this file's contents";

/** Short honest reason, safe to show in the UI. */
export function textStatusReason(meta: MetaLike): string | null {
  const note = meta?.text_note ?? null;
  return note && note.trim() ? note.trim() : null;
}
