import { initialsOf } from "@/lib/initials";

export type TeammateMark = { name: string | null; initials: string | null };

export function teammateMarkFor(input: {
  ownership: string;
  ownerProfileId: string | null | undefined;
  members: { id: string; display_name: string | null }[];
}): TeammateMark | null {
  if (input.ownership !== "teammate") return null;
  const member = input.members.find((entry) => entry.id === input.ownerProfileId);
  const name = member?.display_name?.trim();
  return name ? { name, initials: initialsOf(name) } : { name: null, initials: null };
}