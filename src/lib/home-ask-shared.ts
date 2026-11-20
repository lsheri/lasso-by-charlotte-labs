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

let handed: HandedQuestion | null = null;
let fromHome = false;
let returning: Rect | null = null;

/** Home hands a question to Firm brain, with its answer when Home already has it, so it is never asked twice. */
export function handOffQuestion(question: string, result: FirmAskResult | null = null): void {
  handed = { question, result };
  fromHome = true;
}

/** Firm brain takes the handed question, once. */
export function takeHandedQuestion(): HandedQuestion | null {
  const question = handed;
  handed = null;
  return question;
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
