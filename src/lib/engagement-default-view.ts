/**
 * Unit D1: opening an engagement lands on its Workboard. A few openings stay on
 * the details page, because they point at something the details page holds.
 */
export type EngagementLandingInput = {
  /** A workstream ledger link, including the wrap-up card. */
  work?: string | undefined;
  /** The Details link back from the board. */
  view?: string | undefined;
  /** A shared "?trace=" audit link. */
  hasTrace: boolean;
  /** A shared "?journey=" link. */
  hasJourney: boolean;
  /** Quick folders stay a list. */
  isQuickFolder: boolean;
  /** Phones keep the details page Work list. */
  isNarrow: boolean;
};

export const ENGAGEMENT_NARROW_WIDTH = 768;

/** The search both board-to-details links carry, so the details page holds. */
export const DETAILS_SEARCH = { view: "details" } as const;

export function shouldOpenWorkboard(input: EngagementLandingInput): boolean {
  if (input.work) return false;
  if (input.view === "details") return false;
  if (input.hasTrace || input.hasJourney) return false;
  if (input.isQuickFolder) return false;
  if (input.isNarrow) return false;
  return true;
}
