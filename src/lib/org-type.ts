/**
 * ONE mapping from what a person picks at the door to the type the workspace
 * is created with. The setup screen and its initial state both read this, so
 * a choice can never mean one thing in the chooser and another on submit.
 */

export type OrgType = "company" | "personal" | "edu";

export type DoorChoice = "company" | "personal" | "edu" | "invite" | null | undefined;

/**
 * An invite never creates a workspace here (the accept page owns that), so it
 * falls back to the same default the screen has always used.
 */
export function orgTypeForChoice(choice: DoorChoice): OrgType {
  if (choice === "personal") return "personal";
  if (choice === "edu") return "edu";
  return "company";
}
