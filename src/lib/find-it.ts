/**
 * PLACEHOLDER. This is not real matching.
 *
 * It stands in for the work of deciding which conversations actually fed a
 * finished piece of work. It exists only so the Find it surface can be
 * designed against something that moves, and it must be replaced before this
 * page is shown to anyone. It compares words in titles and how close two
 * dates are, which is not evidence of anything.
 *
 * Pure on purpose, and alone in this file, so replacing it touches one module.
 */

export type FindItTarget = {
  id: string;
  title: string;
  /** ISO date, the best date known for the piece of work. */
  date: string | null;
};

export type FindItChat = {
  id: string;
  title: string;
  date: string | null;
};

export type FindItCandidate = {
  chatId: string;
  /** 0 to 1 inclusive. A stand-in, never a measurement. */
  score: number;
};

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "for",
  "of",
  "to",
  "in",
  "on",
  "with",
  "v1",
  "v2",
  "final",
  "draft",
  "copy",
]);

function words(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}

/** Words in common, as a share of the smaller title. 0 when either is empty. */
function titleOverlap(a: string, b: string): number {
  const left = words(a);
  const right = words(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const word of left) if (right.has(word)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

/** 1 on the same day, fading to 0 across sixty days. Unknown dates score 0. */
function dateCloseness(a: string | null, b: string | null): number {
  if (!a || !b) return 0;
  const left = Date.parse(a);
  const right = Date.parse(b);
  if (Number.isNaN(left) || Number.isNaN(right)) return 0;
  const days = Math.abs(left - right) / 86_400_000;
  return Math.max(0, 1 - days / 60);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** The placeholder score for one chat against one target. 0 to 1 inclusive. */
export function scoreChat(target: FindItTarget, chat: FindItChat): number {
  return clamp01(titleOverlap(target.title, chat.title) * 0.75 + dateCloseness(target.date, chat.date) * 0.25);
}

/** Every chat scored, strongest first. Nothing is filtered out here. */
export function findCandidates(target: FindItTarget, chats: FindItChat[]): FindItCandidate[] {
  return chats
    .map((chat) => ({ chatId: chat.id, score: scoreChat(target, chat) }))
    .sort((a, b) => b.score - a.score);
}
