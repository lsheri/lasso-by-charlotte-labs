/**
 * The demo tour's logins and what a reset must leave on the Marrowfield proposal board. Pure data, no server code.
 *
 * The kept rows are test data held on purpose (Liam, 19 Nov): one proposal draft, three ledger rows and a value of
 * USD 380,000. They are named by id, so a reset can only ever keep exactly these and refuses when one is missing.
 * If the demo firm is seeded again these ids change and must be set again here.
 */

export const TOUR_BOARD_ID = "4a4abc70-32af-4cdb-8772-3850f9d673bc";

export type TourPerson = { key: string; name: string; role: "lead" | "em"; plays: string };

/** Never an admin, and never the password the seeded demo people share: each gets its own, shown once. */
export const TOUR_PEOPLE: readonly TourPerson[] = [
  { key: "tour-partner", name: "Rowan Ashby", role: "lead", plays: "Partner" },
  { key: "tour-lead", name: "Jules Marlow", role: "em", plays: "Engagement lead" },
];

export const TOUR_KEEP = {
  draftItemId: "79e157b2-886c-4ab5-9d42-6d77e065983d",
  ledger: [
    { id: "28aeb6ed-c173-4459-a015-a33b55f77d8a", kind: "brief_received", occurred_at: "2026-11-19T05:23:24.479Z", source_ref: null, sections_total: null, sections_sourced: null, questions_prepared: null },
    {
      id: "245b4a28-659d-4064-8191-8892a0278bf0",
      kind: "draft_completed",
      occurred_at: "2026-11-19T05:24:12.64Z",
      source_ref: "79e157b2-886c-4ab5-9d42-6d77e065983d",
      sections_total: 9,
      sections_sourced: 7,
      questions_prepared: 5,
    },
    { id: "d9d467b1-3b93-42a0-b74e-17f1d4c6a2cf", kind: "questions_sent", occurred_at: "2026-11-18T12:00:00Z", source_ref: null, sections_total: null, sections_sourced: null, questions_prepared: null },
  ],
  value: { amount: 380000, currency: "USD" },
} as const;

export type TourResetLeft = { shared: boolean; ledgerRows: number; value: string | null; marks: number; draft: boolean };

/** True only when the board is exactly as it must be left. */
export function tourLeftClean(left: TourResetLeft): boolean {
  return !left.shared && left.ledgerRows === TOUR_KEEP.ledger.length && left.value === `${TOUR_KEEP.value.amount} ${TOUR_KEEP.value.currency}` && left.marks === 0 && left.draft;
}
