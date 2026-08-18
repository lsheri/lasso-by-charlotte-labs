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
    label: "Invite a coach",
    hint: "Optional. They see only what you map.",
    optional: true,
    to: "/members",
    done: (p) => (p.counts.invites > 0 ? `${p.counts.invites} invites created` : null),
  },
];

const coachSteps: ChecklistStepDef[] = [
  {
    id: "shared-engagement",
    label: "Open an engagement shared with you",
    hint: "Shared work is the only work you can open.",
    to: "/work",
    done: (p) =>
      p.counts.shared_engagements > 0
        ? `${p.counts.shared_engagements} engagements shared with you`
        : null,
  },
  {
    id: "coach-analysis",
    label: "Run an analysis on shared work",
    hint: "Scoped to one engagement, never to a person.",
    to: "/reflect",
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
  return progress.is_admin ? [...base, ...adminSteps] : base;
}

export function requiredCount(steps: ChecklistStepDef[]): number {
  return steps.filter((s) => !s.optional).length;
}

export function completedRequired(steps: ChecklistStepDef[], progress: OnboardingProgress): number {
  return steps.filter((s) => !s.optional && s.done(progress) !== null).length;
}
