/**
 * 19 Nov 2026 (Liam): what each role gets from the menu's Firm brain row and on Home. The pure rules and the words.
 *
 * Firm brain is the firm's past work, ready to ask. Everyone who may ask the firm gets the row. The map stays with
 * admins and leads, as on Firm view. Nothing here reads a fee or a value, and nothing rates a person.
 */

import { canAskTheFirm } from "./firm-ask-shared";

type RoleProfile = { role?: string | null; has_firm_view?: boolean | null; org_type?: string | null; is_guest?: boolean | null } | null | undefined;

/**
 * What the Firm brain page shows this person. "map": the firm map as the page, with Ask the firm floating on it, for
 * everyone in the firm (20 Nov, D-85: members see the map too; fees stay with admins and leads, and the
 * server leaves them out for everyone else). "none": a coach, a guest, or a workspace that is not a company.
 */
export function firmBrainAccess(profile: RoleProfile): "map" | "none" {
  if (!canAskTheFirm(profile) || profile?.is_guest === true) return "none";
  return "map";
}

/** Home leads with the proposals picture for an admin of a company workspace. Everyone else keeps Home as it was. */
export function homeShowsProposals(profile: RoleProfile): boolean {
  return canAskTheFirm(profile) && profile?.is_guest !== true && profile?.role === "admin";
}

/** How many proposals Home shows before it points to the Proposals page. */
export const HOME_PROPOSAL_ROWS = 3;

export const FIRM_BRAIN_COPY = {
  nav: "Firm brain",
  title: "Firm brain",
  subtitle: "Ask what the firm has done before, and see how it was done.",
  notHere: "Firm brain is for the members of a company workspace.",
  notHereCoach: "Firm brain is for the firm's own team. As a coach you do not see it.",
} as const;

export const FIRM_VIEW_COPY = {
  title: "Firm view",
  /** Said to someone in the firm who is not an admin or a lead. */
  adminsAndLeads: "Firm view is for admins and leads.",
  openFirmBrain: "Open Firm brain",
  /** Said in a workspace that is not a company. */
  noFirmView: "Your workspace does not have a firm view.",
} as const;

export const HOME_PROPOSALS_COPY = {
  title: "Proposals",
  open: "Open Proposals",
  seeAll: (count: number) => `See all ${count} in Proposals`,
} as const;
