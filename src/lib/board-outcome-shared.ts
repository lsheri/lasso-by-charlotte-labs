import { parseOutcome, type ParsedOutcome } from "@/lib/proposal-shared";

/**
 * How an engagement ended (Liam, 18 Nov: "if we demo it it must be real"). Precedents show "ran to plan, client
 * extended" and the lesson from engagements.outcome; before this only the demo seed wrote it. The board's editors set
 * it here, in the one line format parseOutcome already reads. Still running means no outcome at all.
 */

export const BOARD_OUTCOME_COPY = {
  menu: "How it ended…",
  title: "How it ended",
  helper: "Shown on this engagement when it comes up as a precedent for a new proposal. Only for finished work.",
  planLabel: "Plan",
  running: "Still running",
  ranToPlan: "Ran to plan",
  overran: "Overran",
  extendedLabel: "Extension",
  unknown: "Not recorded",
  extended: "Client extended",
  notExtended: "Not extended",
  lessonLabel: "What we would do differently (optional)",
  lessonPlaceholder: "Book CFO time in week one, not week four.",
  save: "Save",
  cancel: "Cancel",
  failed: "Could not save. Only people who can edit this board can set how it ended.",
  loadFailed: "Could not load how this engagement ended. Close and try again.",
  longLesson: "Keep the lesson under 300 characters.",
  lessonNeedsPlan: "Pick ran to plan or overran before adding a lesson.",
} as const;

export const MAX_LESSON_CHARS = 300;

export type OutcomeChoice = { plan: "running" | "ran" | "overran"; extended: "unknown" | "yes" | "no"; lesson: string };

export function choiceFromOutcome(outcome: string | null): OutcomeChoice {
  const parsed: ParsedOutcome = parseOutcome(outcome);
  return {
    plan: parsed.ranToPlan === null ? "running" : parsed.ranToPlan ? "ran" : "overran",
    extended: parsed.extended === null ? "unknown" : parsed.extended ? "yes" : "no",
    lesson: parsed.lesson ?? "",
  };
}

export function validateOutcome(choice: OutcomeChoice): string | null {
  const lesson = choice.lesson.trim();
  if (lesson.length > MAX_LESSON_CHARS) return BOARD_OUTCOME_COPY.longLesson;
  if (choice.plan === "running" && lesson) return BOARD_OUTCOME_COPY.lessonNeedsPlan;
  return null;
}

/** The engagements.outcome value: null while running, else "Ran to plan. Client extended. Lesson". */
export function formatOutcome(choice: OutcomeChoice): string | null {
  if (choice.plan === "running") return null;
  const lesson = choice.lesson.trim().replace(/\s+/g, " ");
  const parts = [
    choice.plan === "ran" ? "Ran to plan." : "Overran.",
    choice.extended === "yes" ? "Client extended." : choice.extended === "no" ? "Not extended." : null,
    lesson ? (/[.!?]$/.test(lesson) ? lesson : `${lesson}.`) : null,
  ];
  return parts.filter(Boolean).join(" ");
}
