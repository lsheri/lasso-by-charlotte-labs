/**
 * PASS 170 — one definition of what a coaching link means in the product.
 *
 * A link is person to person. Nothing here re-implements the access rule that
 * the database already carries; these helpers only describe a link, decide
 * which state a person should be shown, and derive the neutral labels a
 * structural coach sees instead of client and engagement names.
 */

export type CoachingRelation = "manager" | "outside_coach";
export type CoachingAccessLevel = "structural" | "full_transcript";
export type CoachingBasis = "subject_consent" | "firm_policy";

export type CoachingLinkRow = {
  id: string;
  org_id: string;
  subject_profile_id: string;
  coach_profile_id: string | null;
  relation: string;
  scope: string;
  access_level: string;
  basis: string;
  agreement_ref: string | null;
  consented_at: string | null;
  consent_withdrawn_at: string | null;
  disclosed_at: string | null;
  ended_at: string | null;
  created_at: string;
};

/**
 * pending  — a consent link nobody has agreed to yet. Invisible to the coach.
 * active   — the coach can see what the access level allows.
 * withdrawn— the person changed their mind. The coach sees access ended.
 * ended    — the link is over, from either side.
 */
export type CoachingLinkState = "pending" | "active" | "withdrawn" | "ended";

export function linkState(row: CoachingLinkRow): CoachingLinkState {
  if (row.ended_at) return "ended";
  if (row.basis === "firm_policy") return "active";
  if (row.consent_withdrawn_at) return "withdrawn";
  return row.consented_at ? "active" : "pending";
}

/** Firm policy is told, not asked. Only a consent link ever shows a question. */
export function asksForAgreement(row: CoachingLinkRow): boolean {
  return row.basis === "subject_consent";
}

/** A firm policy link needs saying once, and only once. */
export function needsDisclosure(row: CoachingLinkRow): boolean {
  return row.basis === "firm_policy" && !row.disclosed_at && !row.ended_at;
}

/**
 * Structural access: an outside coach without full transcript. They read shape,
 * declared work types and journey bands, never client or engagement names.
 */
export function isStructural(row: CoachingLinkRow): boolean {
  return row.relation === "outside_coach" && row.access_level !== "full_transcript";
}

const HASH_OFFSET = 2166136261;
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function hash(value: string): number {
  let h = HASH_OFFSET;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/**
 * A stable, per link name for something a structural coach may not see the real
 * name of. The same link and the same subject always give the same label, so a
 * coach can tell two engagements apart across sessions. Two links give different
 * labels for the same engagement, so two coaches cannot line their notes up.
 */
export function neutralLabel(
  linkId: string,
  key: string,
  kind: "engagement" | "client" = "engagement",
): string {
  const h = hash(`${linkId}|${kind}|${key}`);
  const letter = LETTERS[h % LETTERS.length] ?? "A";
  const digit = Math.floor(h / LETTERS.length) % 10;
  return `${kind === "engagement" ? "Engagement" : "Client"} ${letter}${digit}`;
}

/** Dimensions every coaching link event carries. Closed vocabulary, no names. */
export function linkDims(row: CoachingLinkRow): {
  basis: string;
  relation: string;
  access_level: string;
  scope: string;
} {
  return {
    basis: row.basis,
    relation: row.relation,
    access_level: row.access_level,
    scope: row.scope,
  };
}

/** One wording for each coaching state, so no surface invents its own. */
export const COACHING_COPY = {
  pendingTitle: "Someone would like to coach your work",
  pendingDecline: "Decline",
  pendingAccept: "Accept",
  declineReassurance:
    "Declining changes nothing about your standing here. Nobody is told why, and you can be asked again later.",
  firmTitle: "Your firm has arranged coaching",
  firmAcknowledge: "Got it",
  accessEnded: "Access ended",
  accessEndedBody: "This person is no longer sharing work with you.",
  withdrawLabel: "Stop sharing",
  excludeLabel: "Keep this out of coaching",
  restoreLabel: "Share this again",
  excludeHelp: "You choose what a coach sees. Nobody is told when you keep something back.",
} as const;

/** Plain sentence for what a coach would see at the level actually granted. */
export function accessSentence(row: CoachingLinkRow): string {
  if (row.access_level === "full_transcript") {
    return "They would see the work you have mapped to engagements, including the full text of those pieces.";
  }
  return "They would see the shape of the work you have mapped to engagements: what kind of work it is and how it moved, without client or engagement names.";
}

/** Who the link is, said without ceremony. */
export function relationSentence(row: CoachingLinkRow): string {
  return row.relation === "manager"
    ? "They are a manager in your workspace."
    : "They are a coach from outside your workspace.";
}

/**
 * PASS 171 — a coach accepting an invite claims the links an admin set up for
 * them. Counts never leave as exact values, and nobody ever sees a count of
 * people who said no.
 */
export type ClaimedBand = "0" | "1" | "2-5" | "6+";

export function claimedBand(n: number): ClaimedBand {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  return "6+";
}

/** What a coach is told after their invite is accepted. Plain, no counts of refusals. */
export function claimedLine(n: number): string {
  if (n <= 0) {
    return "Nobody is sharing work with you yet. You will see people here as soon as they choose to.";
  }
  if (n === 1) return "One person has been asked to share their work with you.";
  return `${n} people have been asked to share their work with you.`;
}

/** Copy for setting up an outside coach alongside their invite. */
export const COACH_SETUP_COPY = {
  chooseTitle: "Who should this coach hear about?",
  chooseHelp:
    "Each person is asked first. Nothing is shared until they agree, and they can stop at any time.",
  none: "You can choose people later instead.",
} as const;
