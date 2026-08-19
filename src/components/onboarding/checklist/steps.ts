import type { GuideId } from "@/lib/onboarding-guide";
import type { OnboardingProgress } from "@/lib/onboarding-progress.functions";

export type ChecklistStepDef = {
  id: GuideId;
  label: string;
  hint: string;
  optional?: boolean;
  /** Copy shown once the record says this is done. Never a generic "done". */
  done: (p: OnboardingProgress) => string | null;
  to: string;
};

/** Coaches see only what a person has shared, so their steps never read work. */
export const COACH_PRIVACY_LINE =
  "You see only what someone has chosen to share with you. Raw files, private work and unmapped work stay with them. This is here to endorse good work, not to monitor anyone.";

const workerSteps: ChecklistStepDef[] = [
  {
    id: "connect",
    label: "Connect where your AI work happens",
    hint: "One source is enough to start.",
    to: "/connectors",
    done: (p) => (p.counts.capture > 0 ? `${p.counts.capture} capture route connected` : null),
  },
  {
    id: "capture",
    label: "Bring in your first piece of work",
    hint: "Push it, paste it or import it.",
    to: "/work",
    done: (p) => (p.counts.work_items > 0 ? `${p.counts.work_items} items in your record` : null),
  },
  {
    id: "map",
    label: "Map one item to a workstream",
    hint: "Mapping is how work gets a home.",
    to: "/work",
    done: (p) => (p.counts.mapped > 0 ? `${p.counts.mapped} items mapped` : null),
  },
  {
    id: "analyze",
    label: "Run your first analysis",
    hint: "Lasso reads what you point it at, and shows you first.",
    to: "/work",
    done: (p) => (p.counts.analyses > 0 ? `${p.counts.analyses} analyses run` : null),
  },
  {
    id: "invite-coach",
    label: "Share work with a coach",
    hint: "Optional. Share an engagement with a coach who is already here, or invite a new one. They see only what you share.",
    optional: true,
    to: "/members",
    // Sharing is the point of the step, so a share counts before an invite
    // does. Both are read from the record, and both are scoped to this person.
    done: (p) =>
      p.counts.shared_by_me > 0
        ? `${p.counts.shared_by_me} engagements shared`
        : p.counts.invites_by_me > 0
          ? `${p.counts.invites_by_me} invites created`
          : null,
  },
];

/**
 * Without invite rights the same step is a sharing step only, and it points at
 * the engagement list rather than the member console.
 */
const shareOnlyCoachStep: ChecklistStepDef = {
  id: "invite-coach",
  label: "Share work with a coach",
  hint: "Optional. Share an engagement with a coach who is already here. They see only what you share.",
  optional: true,
  to: "/engagements",
  done: (p) => (p.counts.shared_by_me > 0 ? `${p.counts.shared_by_me} engagements shared` : null),
};

const coachSteps: ChecklistStepDef[] = [
  {
    id: "shared-engagement",
    label: "Open an engagement shared with you",
    hint: "Shared work is the only work you can open.",
    to: "/coaching",
    done: (p) =>
      p.counts.shared_engagements > 0
        ? `${p.counts.shared_engagements} engagements shared with you`
        : null,
  },
  {
    id: "coach-analysis",
    label: "Run an analysis on shared work",
    hint: "Scoped to one engagement, never to a person.",
    to: "/coaching",
    done: (p) => (p.counts.analyses > 0 ? `${p.counts.analyses} analyses run` : null),
  },
  {
    id: "firm-check",
    label: "Write a firm check",
    hint: "The standard you want the work held to.",
    to: "/coaching",
    done: (p) => (p.counts.firm_checks > 0 ? `${p.counts.firm_checks} firm checks authored` : null),
  },
  {
    id: "one-on-one",
    label: "Prepare a 1:1",
    hint: "Built from what has been shared with you.",
    to: "/one-on-one",
    done: (p) => (p.counts.one_on_one > 0 ? `${p.counts.one_on_one} talking points saved` : null),
  },
];

const adminSteps: ChecklistStepDef[] = [
  {
    id: "naming",
    label: "Set your naming conventions",
    hint: "So engagements read the same way for everyone.",
    to: "/settings",
    done: (p) => (p.naming_set ? "Naming conventions saved" : null),
  },
  {
    id: "invite-team",
    label: "Invite your team",
    hint: "Each person's work stays private to them.",
    to: "/members",
    done: (p) => (p.counts.members > 1 ? `${p.counts.members} people in the workspace` : null),
  },
];

export function stepsFor(progress: OnboardingProgress): ChecklistStepDef[] {
  const base = progress.role_variant === "coach" ? coachSteps : workerSteps;
  // Sharing stays open to everyone. Only the invite wording and the member
  // console link are admin only, so a worker keeps the step in share form.
  const scoped = progress.can_invite
    ? base
    : base.map((step) => (step.id === "invite-coach" ? shareOnlyCoachStep : step));
  if (!progress.is_admin) return scoped;
  // Admin extras: naming for the console, inviting only where minting is allowed.
  const extras = progress.can_invite ? adminSteps : adminSteps.filter((s) => s.id !== "invite-team");
  return [...scoped, ...extras];
}

export function requiredCount(steps: ChecklistStepDef[]): number {
  return steps.filter((s) => !s.optional).length;
}

export function completedRequired(steps: ChecklistStepDef[], progress: OnboardingProgress): number {
  return steps.filter((s) => !s.optional && s.done(progress) !== null).length;
}
