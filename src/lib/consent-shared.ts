import type { ConsentPurpose } from "./telemetry-v2-shared";

/** The version of the plain language shown below. Bump it when the copy changes. */
export const CONSENT_POLICY_VERSION = "dp-2026-09";

/** Highest granted purpose wins, and operate is always on. */
export const PURPOSE_RANK: Record<ConsentPurpose, number> = {
  operate: 0,
  customer_analytics: 1,
  deidentified_improvement: 2,
  research: 3,
};

export type PurposeCopy = {
  purpose: ConsentPurpose;
  title: string;
  unlocks: string;
  declining: string;
  alwaysOn?: boolean;
};

export const PURPOSE_COPY: PurposeCopy[] = [
  {
    purpose: "operate",
    title: "Operate the product",
    unlocks: "Keeps your work, your engagements and your history available to you inside Lasso.",
    declining: "This one cannot be turned off, because without it there is no product to use.",
    alwaysOn: true,
  },
  {
    purpose: "customer_analytics",
    title: "Analytics for your organisation",
    unlocks:
      "Allows aggregate, team-level reporting for your admins. It never includes individual people's prompts or conversations. Reporting views are on the way; until then this records your firm's choice.",
    declining:
      "Declining means your admins will see no organisation-level picture, only their own work.",
  },
  {
    purpose: "deidentified_improvement",
    title: "Deidentified product improvement and benchmarking",
    unlocks:
      "Allows de-identified data to inform product improvement and future benchmarking. No names, titles or content are included. Comparison views are on the way; until then this records your firm's choice.",
    declining:
      "Declining means no comparison to other organisations, and your data shapes nothing outside your workspace.",
  },
  {
    purpose: "research",
    title: "Formal research",
    unlocks:
      "Allows deidentified records to be used in published research about how people work with AI, under a written protocol.",
    declining: "Declining keeps your organisation out of every study. Nothing else changes.",
  },
];
