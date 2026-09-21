/**
 * S2: the two things a person can be given on a board, in plain words.
 *
 * Nothing here reads or writes anything. The database function owns every
 * rule about who may give what; this file only holds the shapes and the copy.
 */

export type EngagementAccessChoice = "review" | "work";
export type EngagementAccessValue = EngagementAccessChoice | "none";

export const ENGAGEMENT_ACCESS_VALUES: readonly EngagementAccessValue[] = [
  "review",
  "work",
  "none",
] as const;

export function isEngagementAccessValue(value: unknown): value is EngagementAccessValue {
  return typeof value === "string" && (ENGAGEMENT_ACCESS_VALUES as readonly string[]).includes(value);
}

/** One person in the workspace, with what they have on this board today. */
export type EngagementPerson = {
  id: string;
  display_name: string;
  access: EngagementAccessChoice | null;
  isYou: boolean;
};

export type EngagementPeoplePayload = {
  people: EngagementPerson[];
  canShare: boolean;
};

/** The two choices, said as what the person can do, never as a level. */
export const ACCESS_CHOICES: readonly {
  value: EngagementAccessChoice;
  label: string;
  line: string;
}[] = [
  {
    value: "review",
    label: "Review",
    line: "They can open the board, read it, search the record, and add comments and notes. They cannot bring work onto the board and cannot rearrange it.",
  },
  {
    value: "work",
    label: "Work",
    line: "Everything Review has, plus bringing work onto the board and arranging it.",
  },
] as const;

export function accessLabel(access: EngagementAccessChoice): string {
  return ACCESS_CHOICES.find((choice) => choice.value === access)?.label ?? "";
}

/** The third section. Something we are building, said as that and nothing more. */
export const COMING_TITLE = "Working on the same board together";
export const COMING_LINE =
  "We are building a way for two people to work on the same board at the same time, each with their own area that never overlaps the other, and each able to see the other's work.";
export const COMING_STATE = "Not available yet";

/** Closed result words for the one event, worked out from what came back. */
export type AccessResult = "granted" | "changed" | "removed" | "unchanged";

export function accessResult(
  returned: string,
  previous: EngagementAccessChoice | null,
): AccessResult {
  if (returned === "removed") return "removed";
  if (returned === "unchanged") return "unchanged";
  return previous ? "changed" : "granted";
}

/** member_role on this engagement, read as one of the two choices. */
export function accessFromMemberRole(memberRole: string | null): EngagementAccessChoice | null {
  if (!memberRole) return null;
  return memberRole === "coach" ? "review" : "work";
}
