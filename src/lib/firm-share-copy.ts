/**
 * Share with firm, in a company workspace (Liam, 15 Nov 2026). Asked when a board is made, changed in the board's
 * Share dialog, off for every existing board. Distinct from share-up-copy.ts, which is the live link from a personal
 * workspace to a partner firm.
 */
export const FIRM_SHARE_COPY = {
  question: (firm: string) => `Share this board with ${firm}?`,
  notNow: "Not now",
  share: "Share with firm",
  createLine:
    "Your firm's leads and admins see this board's brief and the work placed on it in firm view, as it grows. Items you mark private stay private. Guests never see it. You can change this in Share.",
  heading: "Firm knowledge",
  offLine: "Only people you add can see this board.",
  onLine: (firm: string, since: string, by: string) => `Shared with ${firm} since ${since} by ${by}.`,
  stopTitle: "Stop sharing with the firm?",
  stopBody: "It leaves firm view straight away. Anything colleagues already copied to their own boards stays theirs.",
  stopConfirm: "Stop sharing",
  adminOnlyOff: "You can stop sharing this board. Only its owner can share it.",
  failed: "That did not change. Try again.",
} as const;
