/**
 * Remembers the invite someone arrived with, so an interrupted sign up lands
 * back on the accept page instead of a chooser asking for the code again.
 * Session scoped on purpose: it is a breadcrumb for one visit, not a record.
 */
const KEY = "lasso.pending_invite";

export type PendingInvite = { code: string; eng?: string | undefined };

export function rememberPendingInvite(invite: PendingInvite): void {
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(invite));
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readPendingInvite(): PendingInvite | null {
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingInvite;
    if (!parsed?.code || typeof parsed.code !== "string") return null;
    return typeof parsed.eng === "string" ? { code: parsed.code, eng: parsed.eng } : { code: parsed.code };
  } catch {
    return null;
  }
}

export function clearPendingInvite(): void {
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}
