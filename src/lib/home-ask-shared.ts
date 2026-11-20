/**
 * 21 Nov 2026, D-85 PR B (Liam): Home for everyone in the firm who is not an admin is a mini firm brain. A greeting,
 * one large question box, a few starters built from their own recent boards, then their boards as cards. Asking
 * morphs the box into the Firm brain menu row and the canvas takes over with the answer building.
 *
 * The question travels from Home to Firm brain in memory only: never in the address, history, storage or analytics.
 */

import {
  canAskTheFirm,
  FIRM_ASK_QUESTION_MAX,
  FIRM_ASK_STARTER_COPY,
  startersFor,
  type FirmAskResult,
} from "./firm-ask-shared";

type HomeProfile =
  | {
      role?: string | null;
      has_firm_view?: boolean | null;
      org_type?: string | null;
      is_guest?: boolean | null;
    }
  | null
  | undefined;

/** Home asks the firm for a member of a company workspace who is not an admin (an admin's Home is the operating picture). */
export function homeAsksTheFirm(profile: HomeProfile): boolean {
  return canAskTheFirm(profile) && profile?.is_guest !== true && profile?.role !== "admin";
}

/** "Morning", "Afternoon" or "Evening" by the hour on the person's own clock. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

/** The first word of a display name, for the greeting. Nothing at all rather than a guess. */
export function firstNameOf(displayName: string | null | undefined): string {
  return (displayName ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * Starters as whole questions, finished with the person's most recent board, so one press asks something real.
 * "What we charged" stays with admins and leads, as in Ask the firm. With no board yet, the starters are left out.
 */
export function homeStarters(
  role: string | null | undefined,
  recentBoard: string | null | undefined,
): string[] {
  const board = (recentBoard ?? "").trim();
  if (!board) return [];
  return startersFor(role).map((key) =>
    `${FIRM_ASK_STARTER_COPY[key].stem}${board}?`.slice(0, FIRM_ASK_QUESTION_MAX),
  );
}

export const HOME_ASK_COPY = {
  greeting: (hour: number, first: string) =>
    first ? `${greetingFor(hour)}, ${first}` : greetingFor(hour),
  placeholder: "Ask about your work, or what the firm has done before",
  label: "Question for the firm",
  scope: "Work shared with the firm",
  send: "Ask",
  boards: "Your boards",
} as const;

/* ---------------------------------------------------------------------------------------------------------------
 * The hand-off between Home and Firm brain. Memory only, one question at a time, taken once.
 * ------------------------------------------------------------------------------------------------------------- */

type Rect = { left: number; top: number; width: number; height: number };

/** What Home hands over: the question, and the answer when Home already asked (the orb turns to it first). */
export type HandedQuestion = { question: string; result: FirmAskResult | null };

/** A hand-off older than this is never picked up: it belongs to a trip that did not happen (QA H2). */
export const HAND_OFF_MS = 2 * 60_000;

let handed: (HandedQuestion & { profileId: string; at: number }) | null = null;
/** An open Firm brain page listening for a question handed over while it is already on screen (the chat pill). */
const listeners = new Set<() => void>();
let fromHome = false;
let returning: Rect | null = null;

/** Home hands a question to Firm brain, with its answer when Home already has it, so it is never asked twice. */
export function handOffQuestion(
  question: string,
  result: FirmAskResult | null,
  profileId: string,
  now = Date.now(),
  /** 20 Nov, chat pill: a question from the pill did not come from Home's box, so Firm brain shows no Home button. */
  options: { fromHome?: boolean } = {},
): void {
  handed = { question, result, profileId, at: now };
  fromHome = options.fromHome ?? true;
  for (const listener of [...listeners]) listener();
}

/**
 * 20 Nov, chat pill: a Firm brain page already on screen hears of a handed question at once, and takes it the usual
 * way (once, only for the same person, only while fresh). Returns the way to stop listening.
 */
export function subscribeHandOff(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Firm brain takes the handed question, once, and only for the person it was handed to, only while it is fresh. Any
 * other take clears it, so nothing is left in memory for someone else or for days later.
 */
export function takeHandedQuestion(
  profileId: string | null | undefined,
  now = Date.now(),
): HandedQuestion | null {
  const found = handed;
  handed = null;
  if (!found || !profileId || found.profileId !== profileId || now - found.at > HAND_OFF_MS)
    return null;
  return { question: found.question, result: found.result };
}

/** Home lets go of a hand-off it made when the person left before Firm brain opened (QA H2). */
export function clearHandOff(): void {
  handed = null;
  fromHome = false;
}

/** Whether Firm brain was opened from Home's question box, so Back can return the same way. */
export function cameFromHome(): boolean {
  return fromHome;
}

/** Firm brain starts the way back: where the box should grow from (the menu row). */
export function startReturn(from: Rect | null): void {
  returning = from;
  fromHome = false;
}

/** Home takes where to grow its box from, once. */
export function takeReturn(): Rect | null {
  const from = returning;
  returning = null;
  return from;
}

/** Test hook. */
export function resetHomeHandOff(): void {
  handed = null;
  fromHome = false;
  returning = null;
}
