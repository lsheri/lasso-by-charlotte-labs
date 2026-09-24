/**
 * S1: the expiring board link, the client-safe half.
 *
 * Nothing here touches the database and nothing here can make a token. The
 * raw token exists exactly once, in the URL handed back at creation, and is
 * never stored: only its sha256 hash reaches a row. A copy of that table
 * opens no board.
 */

import type { WorkboardDto } from "./canvas-lab-shared";
import type { WorkItemRow } from "./work-types";
import type { WorkboardCardPreview, WorkboardFilePreview } from "./workboard-card-preview.shared";

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

/**
 * S3a: the shared board carries exactly what the live board page feeds its
 * model: the saved board in the live loader's shape, and the canonical seed
 * inputs the virtual base is built from. Nothing names a person or an org:
 * author ids are replaced with an opaque index made fresh for each response,
 * and the viewer is nobody.
 */
export type SharedWorkboard = Omit<WorkboardDto, "viewerProfileId"> & { viewerProfileId: null };

export type SharedSeedTask = { id: string; name: string; detail: string | null };
export type SharedSeedWork = WorkItemRow & { taskIds: string[] };
export type SharedSeedDecision = { id: string; call: string; situation: string };

export type SharedBoardSeed = {
  brief: string | null;
  tasks: SharedSeedTask[];
  work: SharedSeedWork[];
  decisions: SharedSeedDecision[];
};

export type SharedBoardTurn = {
  id: string;
  turn_no: number;
  role: string;
  content: string;
  ts: string | null;
  model: string | null;
};

export type SharedBoardDto = {
  board: SharedWorkboard;
  seed: SharedBoardSeed;
  cardPreviews: Record<string, WorkboardCardPreview>;
  filePreviews: Record<string, WorkboardFilePreview>;
  turns: Record<string, SharedBoardTurn[]>;
  expiresAt: string;
};

/**
 * One shape for a wrong token, an expired one and a revoked one, so the
 * answer cannot be read to learn which links exist.
 */
export type SharedBoardResult = { status: "open"; board: SharedBoardDto } | { status: "closed" };
