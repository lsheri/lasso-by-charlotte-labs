/**
 * ONE definition of the words a workspace uses. Same pattern as role-access.ts:
 * no component decides a label on its own.
 *
 * There are now three word sets: the consulting default, the school set, and
 * the plain personal set.
 *
 * A school workspace (orgs.settings.type === "edu") reads school words. Every
 * other workspace reads exactly the words it read before this module existed,
 * so the default output must stay byte identical.
 */

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
  /** No longer used by the sidebar; retained for tests and legacy surfaces. */
  orgGroup: string;
  /** The firm wide roll up. */
  firmView: string;
  pastWork: string;
  portfolio: string;
  /** Sidebar empty line when nothing has been created yet. */
  noEngagements: string;
  /** The first card in the create dialog. */
  fullEngagement: string;
  /** The submit button in the create dialog. */
  createEngagement: string;

  /** Filtered engagement views, only shown in a school workspace. */
  classes: string;
  projects: string;
  /** Founder asked for "Homework". Students preferred this word. */
  assignments: string;
};

export const DEFAULT_VOCAB: Vocab = {
  client: "Client",
  clients: "Clients",
  engagement: "Workboard",
  engagements: "Workboards",
  newEngagement: "New workboard",
  workstream: "Workstream",
  workstreams: "Workstreams",
  orgGroup: "Your organization",
  firmView: "Firm view",
  pastWork: "Past work",
  portfolio: "Portfolio",
  noEngagements: "No workboards yet",
  fullEngagement: "Full workboard",
  createEngagement: "Create workboard",

  classes: "Workboards",
  projects: "Workboards",
  assignments: "Workstreams",
};

export const EDU_VOCAB: Vocab = {
  client: "Term",
  clients: "Terms",
  engagement: "Workboard",
  engagements: "Workboards",
  newEngagement: "New workboard",
  workstream: "Step",
  workstreams: "Steps",
  orgGroup: "Your school work",
  firmView: "Everyone's work",
  pastWork: "Past work",
  portfolio: "Portfolio",
  noEngagements: "No workboards yet",
  fullEngagement: "Full workboard",
  createEngagement: "Create workboard",

  classes: "Classes",
  projects: "Projects",
  assignments: "Workboards",
};

export const PERSONAL_VOCAB: Vocab = {
  client: "Folder",
  clients: "Folders",
  engagement: "Workboard",
  engagements: "Workboards",
  newEngagement: "New workboard",
  workstream: "Step",
  workstreams: "Steps",
  orgGroup: "Your work",
  firmView: "All your work",
  pastWork: "Past work",
  portfolio: "Portfolio",
  noEngagements: "No workboards yet",
  fullEngagement: "Full workboard",
  createEngagement: "Create workboard",

  classes: "Workboards",
  projects: "Workboards",
  assignments: "Steps",
};

// Company first: an unrecognised type falls to the consulting words on
// purpose. The plain personal words are opt in via org_type === "personal".
export function vocabFor(profile: VocabProfile): Vocab {
  const type = profile?.org_type;
  if (type === "edu") return EDU_VOCAB;
  if (type === "personal") return PERSONAL_VOCAB;
  return DEFAULT_VOCAB;
}

