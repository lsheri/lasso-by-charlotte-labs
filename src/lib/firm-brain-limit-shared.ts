/**
 * 19 Nov (Liam, D-19): a daily spend limit on firm brain model calls, now that the firm brain is on for every
 * company workspace. One person may spend up to USD 5 a day and one workspace up to USD 25 a day on the surfaces
 * below. Over either, the next call is refused before any model is called, with the line below. The day is the UTC
 * day. Nothing new is stored: spend is added up from the usage ledger every model call already writes.
 */

/** The firm brain's model surfaces, as they are written to the usage ledger. Tagging (extract) is not one of them. */
export const FIRM_BRAIN_SURFACES: readonly string[] = [
  "firm_ask",
  "firm_ask_select",
  "firm_ask_answer",
  "firm_walkthrough",
  "proposal_brief",
  // 20 Nov 2026, chat pill PR 3a: reading a pasted brief.
  "proposal_brief_read",
  "proposal_precedents",
  "proposal_draft",
  "red_pen",
  "sow_terms",
];

export const FIRM_BRAIN_PERSON_DAILY_USD = 5;
export const FIRM_BRAIN_WORKSPACE_DAILY_USD = 25;
/** The status the server refuses with; the screens read it to show the line below instead of "try again". */
export const FIRM_BRAIN_LIMIT_STATUS = 429;

export const FIRM_BRAIN_LIMIT_COPY = {
  person: "You have reached today's limit for the firm brain. It resets at midnight UTC.",
  workspace: "Your workspace has reached today's limit for the firm brain. It resets at midnight UTC.",
  /** The screens cannot tell which of the two it was, and do not need to. */
  shown: "Today's limit for the firm brain has been reached. It resets at midnight UTC.",
} as const;

export function isFirmBrainSurface(surface: string | null | undefined): boolean {
  return typeof surface === "string" && FIRM_BRAIN_SURFACES.includes(surface);
}

/** Midnight UTC of the day `now` falls on, as the ledger writes its times. */
export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export type SpendRow = { profile_id: string | null; cost_usd: number | null };

/** Which limit, if any, today's rows have reached for this person. A missing or odd cost counts as nothing. */
export function firmBrainLimitReached(rows: readonly SpendRow[], profileId: string | null | undefined): "person" | "workspace" | null {
  let person = 0;
  let workspace = 0;
  for (const row of rows) {
    const cost = typeof row.cost_usd === "number" && Number.isFinite(row.cost_usd) && row.cost_usd > 0 ? row.cost_usd : 0;
    workspace += cost;
    if (profileId && row.profile_id === profileId) person += cost;
  }
  if (person >= FIRM_BRAIN_PERSON_DAILY_USD) return "person";
  if (workspace >= FIRM_BRAIN_WORKSPACE_DAILY_USD) return "workspace";
  return null;
}

/** True when a failed firm brain call was the daily limit, so the screen says so instead of "try again". */
export function isFirmBrainLimit(error: unknown): boolean {
  return error instanceof Response && error.status === FIRM_BRAIN_LIMIT_STATUS;
}
