/**
 * What sharing a board up means, said where it is done (Liam, 15 Nov). Shared boards are live, in-progress views;
 * finished pieces reach the firm through Ship to firm. Sharing never moves a board out of its owner's menu.
 */
export const SHARE_UP_COPY = {
  ownerLine:
    "Shares this board live, as it changes, work in progress included. It stays yours and stays in your menu. Stop sharing any time. Finished pieces go to the firm archive with Ship to firm.",
  ownerMark: (names: string[]) => `Shared live with ${names.join(", ")}`,
  readerLine: "Live and still in progress: you see this board as it changes. Finished pieces arrive in the archive.",
  readerTag: "Live",
} as const;
