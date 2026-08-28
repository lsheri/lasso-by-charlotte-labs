/**
 * PASS 132 — the working card story, the pure half.
 *
 * While a thread analysis runs, the rail plays the conversation back as turn
 * cards in the Work Artifact story's motion. Everything that decides WHAT a
 * card says and WHERE it sits lives here, pure and seeded, so the same chat
 * always walks the same way and two different chats never do.
 *
 * No randomness beyond the seeded generators in journey-path. No colour beyond
 * graphite: this animation depicts reading, not judging.
 */

import { fnv1a, mulberry32 } from "@/lib/journey-path";

/** At most this many cards on screen at once; the oldest leaves as one lands. */
export const TURN_STORY_WINDOW = 6;

/** One card lands roughly this often: the same register as the reading scroll. */
export const CARD_STEP_MS = 1400;

/** Kept as the story's step name; pass 133 slowed it to the reading register. */
export const TURN_STORY_STEP_MS = CARD_STEP_MS;

/** After the last turn, the set holds a beat before the loop starts again. */
export const TURN_STORY_HOLD_MS = 1600;

/** A page of the walk fades out together over this long before the next one. */
export const PAGE_FADE_MS = 400;

/** The card box, in the story's own pixel space. */
export const TURN_CARD_W = 200;
export const TURN_CARD_H = 62;
export const TURN_CARD_GAP = 22;
export const TURN_STORY_W = 280;

/** Cards never touch: this much clear paper between any two card rectangles. */
export const CARD_GAP_MIN = 18;


export type TurnStoryTurn = {
  id: string;
  turn_no: number;
  role: string | null;
  content: string | null;
};

export type TurnCard = {
  id: string;
  turnNo: number;
  /** Assistant turns wear the vendor logo; user turns wear a graphite mark. */
  isAssistant: boolean;
  /** "TURN 3 · ASSISTANT", in the micro-label voice. */
  label: string;
  snippet: string;
  /** Seeded horizontal drift, alternating side to side as the column walks. */
  dx: number;
};

/** Plain text out of markdown: no syntax survives into a one-line snippet. */
export function stripMarkdown(raw: string): string {
  return raw
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\s{0,3}>+\s?/gm, "")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_~]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** One line of the turn, ellipsized rather than wrapped. */
export function turnSnippet(raw: string | null | undefined, max = 60): string {
  const text = stripMarkdown(raw ?? "");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** A model turn by any of the names the record stores. */
export function isAssistantRole(role: string | null | undefined): boolean {
  const value = (role ?? "").trim().toLowerCase();
  return value === "assistant" || value === "model" || value === "ai";
}

/**
 * The seeded drift for one card: which side it leans and how far. Keyed on the
 * work item and the turn number, so the snake is the chat's own shape.
 */
export function turnCardDx(itemId: string, turnNo: number): number {
  const rand = mulberry32(fnv1a(`turn-card:${itemId}:${turnNo}`));
  const side = turnNo % 2 === 0 ? -1 : 1;
  return Math.round((10 + rand() * 24) * side * 100) / 100;
}

/** One card per turn, in turn order. */
export function turnCards(itemId: string, turns: readonly TurnStoryTurn[]): TurnCard[] {
  return [...turns]
    .sort((a, b) => a.turn_no - b.turn_no)
    .map((turn) => {
      const assistant = isAssistantRole(turn.role);
      return {
        id: turn.id,
        turnNo: turn.turn_no,
        isAssistant: assistant,
        label: `TURN ${turn.turn_no} · ${assistant ? "ASSISTANT" : "USER"}`,
        snippet: turnSnippet(turn.content),
        dx: turnCardDx(itemId, turn.turn_no),
      };
    });
}

/** The slice on screen at a given point in the walk. */
export function turnStoryWindow<T>(cards: readonly T[], head: number): T[] {
  const end = Math.max(0, Math.min(head, cards.length));
  return cards.slice(Math.max(0, end - TURN_STORY_WINDOW), end);
}

/**
 * PASS 133 — the canvas walk.
 *
 * The rail is blank paper, not a column. Each card lands a step away from the
 * one before it, in a seeded direction that drifts generally downward the way
 * reading does, and never on top of a card already there. When the paper runs
 * out the walk turns the page and starts again near the top.
 */

export type TurnStage = { width: number; height: number };

export type TurnPlacement = {
  id: string;
  turnNo: number;
  /** Which page of paper this card landed on. */
  page: number;
  /** Top-left of the card box, inside the stage. */
  x: number;
  y: number;
};

type Rect = { x: number; y: number };

/** Clear paper between two card rectangles, gap included. */
function clears(a: Rect, b: Rect): boolean {
  const gap = CARD_GAP_MIN;
  const apart =
    a.x + TURN_CARD_W + gap <= b.x ||
    b.x + TURN_CARD_W + gap <= a.x ||
    a.y + TURN_CARD_H + gap <= b.y ||
    b.y + TURN_CARD_H + gap <= a.y;
  return apart;
}

function inside(p: Rect, stage: TurnStage): boolean {
  return (
    p.x >= 0 &&
    p.y >= 0 &&
    p.x + TURN_CARD_W <= stage.width &&
    p.y + TURN_CARD_H <= stage.height
  );
}

/** Down-ish directions only, mirrored by side so the walk actually snakes. */
const WALK_ANGLES = [90, 62, 38, 118] as const;

/**
 * Where every card of this conversation sits. Pure and seeded: the same item
 * always walks the same way, and two items never do.
 */
export function layoutTurnWalk(
  itemId: string,
  cards: readonly TurnCard[],
  stage: TurnStage,
): TurnPlacement[] {
  const rand = mulberry32(fnv1a(`turn-walk:${itemId}`));
  const maxX = Math.max(stage.width - TURN_CARD_W, 0);
  const maxY = Math.max(stage.height - TURN_CARD_H, 0);

  const out: TurnPlacement[] = [];
  let page = 0;
  let placed: Rect[] = [];
  let prev: Rect | null = null;

  const freshStart = (): Rect => ({
    x: Math.round(rand() * maxX),
    y: Math.round(rand() * Math.min(48, maxY)),
  });

  for (const card of cards) {
    let spot: Rect | null = null;

    if (prev) {
      const side = out.length % 2 === 0 ? 1 : -1;
      for (let attempt = 0; attempt < 8 && !spot; attempt += 1) {
        const angle = WALK_ANGLES[attempt % WALK_ANGLES.length] as number;
        const radians = (angle * Math.PI) / 180;
        const step = 92 + rand() * 74;
        const candidate = {
          x: Math.round(prev.x + Math.cos(radians) * step * side),
          y: Math.round(prev.y + Math.sin(radians) * step),
        };
        if (!inside(candidate, stage)) continue;
        if (placed.some((other) => !clears(candidate, other))) continue;
        spot = candidate;
      }
    }

    if (!spot) {
      // The paper ran out. Turn the page and carry on with the same stream.
      if (prev) {
        page += 1;
        placed = [];
      }
      spot = freshStart();
      if (!inside(spot, stage)) spot = { x: 0, y: 0 };
    }

    placed.push(spot);
    prev = spot;
    out.push({ id: card.id, turnNo: card.turnNo, page, x: spot.x, y: spot.y });
  }

  return out;
}
