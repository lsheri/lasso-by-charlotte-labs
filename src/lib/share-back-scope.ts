/**
 * Pure logic for choosing which boards a sponsor can see. No Supabase import,
 * so it can be tested directly.
 */
export type SponsorScopeState = "shared" | "not_shared" | "sees_everything";

export interface SponsorLinkInput {
  id: string;
  subject_profile_id: string;
  org_id: string;
  scope: string;
  ended_at: string | null;
  consent_withdrawn_at: string | null;
  sponsor_name: string | null;
}

export interface LinkEngagementInput {
  link_id: string;
  engagement_id: string;
}

export interface SponsorScopeRow {
  linkId: string;
  sponsorName: string;
  state: SponsorScopeState;
}

export const SPONSOR_FALLBACK_NAME = "Your sponsor";

export function sponsorScopeRows(
  links: SponsorLinkInput[],
  junction: LinkEngagementInput[],
  engagementId: string,
  subjectProfileId: string,
  orgId: string,
): SponsorScopeRow[] {
  const sharedLinks = new Set(
    junction.filter((row) => row.engagement_id === engagementId).map((row) => row.link_id),
  );
  return links
    .filter(
      (link) =>
        link.subject_profile_id === subjectProfileId &&
        link.org_id === orgId &&
        link.ended_at === null &&
        link.consent_withdrawn_at === null,
    )
    .map((link) => ({
      linkId: link.id,
      sponsorName: link.sponsor_name?.trim() || SPONSOR_FALLBACK_NAME,
      state:
        link.scope === "all_work"
          ? "sees_everything"
          : sharedLinks.has(link.id)
            ? "shared"
            : "not_shared",
    }));
}

export function sponsorScopeLine(row: SponsorScopeRow): string {
  if (row.state === "sees_everything") return `${row.sponsorName} already sees this board, along with all your work.`;
  if (row.state === "shared") return `${row.sponsorName} can see this board.`;
  return `${row.sponsorName} cannot see this board.`;
}
