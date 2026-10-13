/**
 * SH-7c: only a guest seat on a shared board may leave it. A full member of
 * the owning workspace, a coach, or someone with no membership never sees it.
 */
export function canLeaveBoard(
  profile: { id: string; role?: string | null; is_guest?: boolean | null } | null | undefined,
  membership: { profile_id: string } | null | undefined,
): boolean {
  if (!profile || !membership) return false;
  if (profile.role === "coach") return false;
  if (profile.is_guest !== true) return false;
  return membership.profile_id === profile.id;
}

export const LEAVE_BOARD_COPY = {
  menuItem: "Leave board",
  title: "Leave this board?",
  body: "You will lose access to this board. Work you added to it stays on the board for the people still there. Remove it first if you want it off.",
  cancel: "Cancel",
  confirm: "Leave board",
  failed: "Could not leave this board. Try again.",
} as const;

export const REMOVE_FROM_BOARD_COPY = {
  title: "Remove from the board?",
  body: "This takes it off the board. It stays in your work.",
  cancel: "Cancel",
  confirm: "Remove",
} as const;
