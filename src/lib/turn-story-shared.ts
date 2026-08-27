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

/** One card lands roughly this often. */
export const TURN_STORY_STEP_MS = 700;

/** After the last turn, the set holds a beat before the loop starts again. */
export const TURN_STORY_HOLD_MS = 1600;

/** The card box, in the story's own pixel space. */
export const TURN_CARD_W = 200;
export const TURN_CARD_H = 62;
export const TURN_CARD_GAP = 22;
export const TURN_STORY_W = 280;

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
