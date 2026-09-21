/**
 * S1: the expiring board link, the client-safe half.
 *
 * Nothing here touches the database and nothing here can make a token. The
 * raw token exists exactly once, in the URL handed back at creation, and is
 * never stored: only its sha256 hash reaches a row. A copy of that table
 * opens no board.
 */

/** The one window. A link lives 48 hours from the moment it is made. */
export const SHARE_WINDOW_HOURS = 48;
export const SHARE_WINDOW_MS = SHARE_WINDOW_HOURS * 60 * 60 * 1000;

/** 32 random bytes, base64url: 43 characters, no padding. */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function looksLikeShareToken(value: unknown): value is string {
  return typeof value === "string" && SHARE_TOKEN_PATTERN.test(value);
}

export function shareLinkPath(token: string): string {
  return `/shared-board/${token}`;
}

export function shareLinkUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}${shareLinkPath(token)}`;
}

export function shareWindowEnd(from: Date = new Date()): Date {
  return new Date(from.getTime() + SHARE_WINDOW_MS);
}

/** What a person sees about a link they made. Never the token. */
export type BoardShareLinkDto = {
  id: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  openedCount: number;
  lastOpenedAt: string | null;
};

export function shareLinkLive(
  link: Pick<BoardShareLinkDto, "expiresAt" | "revokedAt">,
  now: Date = new Date(),
): boolean {
  if (link.revokedAt) return false;
  return new Date(link.expiresAt).getTime() > now.getTime();
}

export function shareTimeLeftLabel(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  if (hours >= 1) return `Expires in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const minutes = Math.max(1, Math.round(ms / (60 * 1000)));
  return `Expires in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
}

/**
 * The honest sentence, read before the link is made. It says what leaves, to
 * whom, and for how long. When the board holds work owned by somebody else,
 * it says that too, on the same sentence. It never blocks.
 */
export function shareExposureSentence(holdsOthersWork: boolean): string {
  const base =
    `Anyone with this link can see everything on this board, including the AI conversations behind the cards and any text written on it, for ${SHARE_WINDOW_HOURS} hours.`;
  return holdsOthersWork
    ? `${base} This board also holds work owned by other people, so you are sharing their conversations too.`
    : base;
}

/** The two things that otherwise surprise someone. */
export function shareLinkNotes(): [string, string] {
  return [
    `You can expire this link yourself at any point before the ${SHARE_WINDOW_HOURS} hours are up.`,
    "The board keeps changing, so whoever opens the link sees the board as it is then, not as it was when you made the link.",
  ];
}

/** What the viewer is told when a link no longer opens. One answer for all. */
export const SHARE_CLOSED_MESSAGE = "This link has expired.";

export type SharedBoardFrame = {
  id: string;
  kind: string;
  label: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  ord: number;
};

export type SharedBoardNode = {
  id: string;
  frameId: string | null;
  kind: string;
  title: string | null;
  body: string | null;
  judgmentType: string | null;
  x: number;
  y: number;
  w: number;
  h: number;
  workItemId: string | null;
  decisionId: string | null;
};

export type SharedBoardLink = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
};

export type SharedBoardTurn = { turnNo: number; role: string; content: string };

export type SharedBoardItem = {
  id: string;
  title: string;
  type: string;
  turns: SharedBoardTurn[];
};

export type SharedBoardDecision = {
  id: string;
  call: string;
  situation: string;
  why: string;
};

export type SharedBoardDto = {
  frames: SharedBoardFrame[];
  nodes: SharedBoardNode[];
  links: SharedBoardLink[];
  items: SharedBoardItem[];
  decisions: SharedBoardDecision[];
  expiresAt: string;
};

/**
 * One shape for a wrong token, an expired one and a revoked one, so the
 * answer cannot be read to learn which links exist.
 */
export type SharedBoardResult = { status: "open"; board: SharedBoardDto } | { status: "closed" };

/** The stage a read only board is drawn on, from its own contents. */
export function sharedBoardBounds(
  frames: Pick<SharedBoardFrame, "x" | "y" | "w" | "h">[],
  nodes: Pick<SharedBoardNode, "x" | "y" | "w" | "h">[],
): { width: number; height: number } {
  const rects = [...frames, ...nodes];
  const width = rects.reduce((max, rect) => Math.max(max, rect.x + rect.w), 0);
  const height = rects.reduce((max, rect) => Math.max(max, rect.y + rect.h), 0);
  return { width: Math.max(960, width + 120), height: Math.max(600, height + 120) };
}

export function sharedNodeCentre(node: Pick<SharedBoardNode, "x" | "y" | "w" | "h">): {
  x: number;
  y: number;
} {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}
