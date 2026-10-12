/**
 * SH-5f: remembers the board invite someone arrived with, so a new person who
 * sets up their own space first comes back to the accept page afterwards.
 * Local storage with a 14 day expiry, because sign up confirmation can open
 * in a fresh tab.
 */
const KEY = "lasso.pending_board_invite";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export type PendingBoardInviteVia = "signup" | "signin";
export type PendingBoardInvite = { code: string; kind: string | null; via: PendingBoardInviteVia };

export function rememberPendingBoardInvite(invite: PendingBoardInvite, now = Date.now()): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ ...invite, expiresAt: now + TTL_MS }));
  } catch {
    /* storage is a convenience, never a requirement */
  }
}

export function readPendingBoardInvite(now = Date.now()): PendingBoardInvite | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PendingBoardInvite> & { expiresAt?: number };
    if (!p?.code || typeof p.code !== "string") return null;
    if (typeof p.expiresAt !== "number" || p.expiresAt < now) {
      clearPendingBoardInvite();
      return null;
    }
    return {
      code: p.code,
      kind: typeof p.kind === "string" ? p.kind : null,
      via: p.via === "signup" ? "signup" : "signin",
    };
  } catch {
    return null;
  }
}

export function clearPendingBoardInvite(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to clean up */
  }
}

/** The accept page address for a pending invite, or null. */
export function pendingBoardInvitePath(): string | null {
  const p = readPendingBoardInvite();
  return p ? `/board-invite?${new URLSearchParams({ code: p.code }).toString()}` : null;
}
