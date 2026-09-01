/**
 * The five levels of what a workspace shares outside itself, plus the pure
 * helpers both the settings surfaces and the event path rely on.
 *
 * Nothing here reads or writes the database. Every visible string in this file
 * says plainly what leaves and what stays.
 */

export const TIER_ORDER = ["t0", "a", "b", "c", "d"] as const;
export type DataTier = (typeof TIER_ORDER)[number];

/** The copy people read. Bump this when any sentence below changes. */
export const CONSENT_TEXT_VERSION = "dc-v3";

/** Defaults when a state row is missing. */
export const DEFAULT_ORG_TIER: DataTier = "c";
export const DEFAULT_USER_TIER: DataTier = "b";
export const DEFAULT_TIER_D_SWITCH = false;

export function isDataTier(value: unknown): value is DataTier {
  return typeof value === "string" && (TIER_ORDER as readonly string[]).includes(value);
}

export function tierRank(tier: DataTier): number {
  return TIER_ORDER.indexOf(tier);
}

/** The person can never share more than the organization allows. */
export function effectiveTier(
  orgTier?: string | null | undefined,
  userTier?: string | null | undefined,
): DataTier {
  const org = isDataTier(orgTier) ? orgTier : DEFAULT_ORG_TIER;
  const user = isDataTier(userTier) ? userTier : DEFAULT_USER_TIER;
  return tierRank(user) <= tierRank(org) ? user : org;
}

export type TierCopy = {
  tier: DataTier;
  label: string;
  description: string;
};

export const TIER_COPY: TierCopy[] = [
  {
    tier: "t0",
    label: "Workspace only",
    description:
      "Nothing leaves your workspace. Lasso keeps your work available to you and sends nothing about it anywhere else.",
  },
  {
    tier: "a",
    label: "Usage patterns, anonymous",
    description:
      "Counts of how often features are used leave the workspace with no person attached and no way to join one visit to the next. No titles, no names, no work content.",
  },
  {
    tier: "b",
    label: "Usage patterns, linked over time",
    description:
      "The same counts, held under a per-person key so one week can be compared to the next. Still no names, no titles and no work content.",
  },
  {
    tier: "c",
    label: "Work details",
    description:
      "Adds the shape of the work: kinds of documents, dates, engagement structure, titles and file names. The words inside the work stay in your workspace.",
  },
  {
    tier: "d",
    label: "Full work content",
    description: FULL_OPENNESS_COPY,
  },
];

export function tierCopy(tier: DataTier): TierCopy {
  return TIER_COPY.find((entry) => entry.tier === tier) as TierCopy;
}

export function tierLabel(tier: DataTier): string {
  return tierCopy(tier).label;
}

/** Shown under the content switch on the organization surface. */
export const CONTENT_SWITCH_LINE =
  "Full work content applies only to work people have already shared by mapping or shipping it. Private and unmapped work never leaves, at any level.";

/** Shown at the bottom of the personal surface, verbatim. */
export const RIGHTS_BLOCK =
  "You see everything of yours. Private and unmapped work is invisible to everyone, always. Your choice here only ever lowers what leaves, never what you see. You can change it at any time.";

export const CEILING_LINE_PREFIX = "Your organization allows up to: ";
export const ABOVE_CEILING_LINE = "Above your organization's level";
export const SURFACE_NAME = "Your data";

export type ConsentScope = "org" | "user";

/**
 * The exact words a person agreed to. Its sha256 is stored with the choice so
 * the wording can always be recovered later.
 */
export function renderNoticeText(scope: ConsentScope, tier: DataTier): string {
  const copy = tierCopy(tier);
  const who = scope === "org" ? "This organization" : "You";
  const lines = [
    `${SURFACE_NAME} ${CONSENT_TEXT_VERSION}`,
    `${who} chose: ${copy.label}`,
    copy.description,
    CONTENT_SWITCH_LINE,
  ];
  return lines.join("\n");
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function noticeHash(scope: ConsentScope, tier: DataTier): Promise<string> {
  return sha256Hex(renderNoticeText(scope, tier));
}

/** Monday of the ISO week, as a YYYY-MM-DD string in UTC. */
export function isoWeekStart(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export type EngagementBand = "0" | "1-2" | "3-5" | "6+";

export function engagementBand(count: number): EngagementBand {
  if (count <= 0) return "0";
  if (count <= 2) return "1-2";
  if (count <= 5) return "3-5";
  return "6+";
}

/** True when this profile has not been noted yet in the given week. */
export function shouldNotePresence(
  lastNotedWeek: string | null | undefined,
  currentWeek: string,
): boolean {
  return lastNotedWeek !== currentWeek;
}

/** One name for the element on both surfaces. */
export const SAMPLE_BUTTON_LABEL = "See a sample";
export const SAMPLE_EMPTY_LINE = "Nothing leaves your workspace at this level.";
export const SAMPLE_NO_KEY_LINE = "No person key. One visit cannot be joined to the next.";
export const SAMPLE_PERSON_KEY_LINE = "person_key: a1b2… (a random key, not your name or email)";
export const SAMPLE_CONTENT_LINE = "Only work already shared by mapping or shipping.";
export const SAMPLE_INTRO_LINE = "This is exactly what one item looks like when it leaves.";

export type SampleField = { key: string; value: string };

export type SampleEvent = {
  tier: DataTier;
  /** Empty at t0, where nothing leaves at all. */
  fields: SampleField[];
  notes: string[];
};

/**
 * A hardcoded, realistic picture of one item leaving the workspace at a level.
 * Nothing here reads real work; every value is made up on purpose.
 */
export function sampleEventForTier(tier: DataTier): SampleEvent {
  if (tier === "t0") return { tier, fields: [], notes: [SAMPLE_EMPTY_LINE] };

  const fields: SampleField[] = [
    { key: "name", value: "workitem.mapped" },
    { key: "when", value: "2026-09-01T09:14:00Z" },
    { key: "workspace_size", value: "11-50" },
    { key: "items_this_week", value: "3-5" },
  ];
  const notes: string[] = [];

  if (tier === "a") {
    notes.push(SAMPLE_NO_KEY_LINE);
    return { tier, fields, notes };
  }

  fields.push({ key: "person_key", value: "a1b2…" });
  notes.push(SAMPLE_PERSON_KEY_LINE);

  if (tier === "b") return { tier, fields, notes };

  fields.push(
    { key: "title", value: "Q3 pricing review" },
    { key: "file_name", value: "pricing-review-v4.pptx" },
    { key: "kind", value: "deck" },
  );

  if (tier === "c") return { tier, fields, notes };

  fields.push({
    key: "excerpt",
    value: "Recommend holding list price and moving the discount floor to 12 percent.",
  });
  notes.push(SAMPLE_CONTENT_LINE);
  return { tier, fields, notes };
}

/** The optional research block on the personal surface. */
export const RESEARCH_HEADING = "Research";
export const RESEARCH_BODY =
  "Lasso runs studies on how people work with AI, using material at your chosen level above. Taking part is a separate choice, always yours, and changing it never affects anything else in your workspace.";
export const RESEARCH_SAVED_LINE = "Saved. Your choice is recorded.";
export const RESEARCH_EVENT = "consent.research_change" as const;
export type ResearchChoice = "joined" | "left";
