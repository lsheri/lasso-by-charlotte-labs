/**
 * ONE definition of the words a workspace uses. Same pattern as role-access.ts:
 * no component decides a label on its own.
 *
 * A school workspace (orgs.settings.type === "edu") reads school words. Every
 * other workspace reads exactly the words it read before this module existed,
 * so the default output must stay byte identical.
 */

export type OrgTypeName = "company" | "personal" | "edu";

export type VocabProfile = { org_type?: string | null } | null | undefined;

export function isEduOrg(profile: VocabProfile): boolean {
  return profile?.org_type === "edu";
}

export type Vocab = {
  client: string;
  clients: string;
  engagement: string;
  engagements: string;
  newEngagement: string;
  workstream: string;
  workstreams: string;
  /** The nav group that holds shared, organization wide places. */
  orgGroup: string;
  /** The firm wide roll up. */
  firmView: string;
  pastWork: string;
  portfolio: string;
  /** Filtered engagement views, only shown in a school workspace. */
  classes: string;
  projects: string;
  /** Founder asked for "Homework". Students preferred this word. */
  assignments: string;
};

export const DEFAULT_VOCAB: Vocab = {
  client: "Client",
  clients: "Clients",
  engagement: "Engagement",
  engagements: "Engagements",
  newEngagement: "New engagement",
  workstream: "Workstream",
  workstreams: "Workstreams",
  orgGroup: "Your organization",
  firmView: "Firm view",
  pastWork: "Past work",
  portfolio: "Portfolio",
  classes: "Engagements",
  projects: "Engagements",
  assignments: "Workstreams",
};

export const EDU_VOCAB: Vocab = {
  client: "Term",
  clients: "Terms",
  engagement: "Class or project",
  engagements: "Classes and projects",
  newEngagement: "New class or project",
  workstream: "Assignment",
  workstreams: "Assignments",
  orgGroup: "Your school work",
  firmView: "Everyone's work",
  pastWork: "Past work",
  portfolio: "Portfolio",
  classes: "Classes",
  projects: "Projects",
  assignments: "Assignments",
};

export function vocabFor(profile: VocabProfile): Vocab {
  return isEduOrg(profile) ? EDU_VOCAB : DEFAULT_VOCAB;
}
