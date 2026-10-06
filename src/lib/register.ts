/**
 * Unit C: the register is derived from the door someone came through, never
 * asked. It is the same union as OrgType on purpose, so the two cannot drift.
 */
import { readEduIntent } from "@/lib/edu-entry";
import type { OrgType } from "@/lib/org-type";

export type Register = OrgType;

/** Returns the register a door implies, or null when there is no door signal. */
export function deriveRegister(intent: unknown): Register | null {
  if (intent === "company" || intent === "personal" || intent === "edu" || intent === "partner")
    return intent;
  if (readEduIntent()) return "edu";
  return null;
}

export type RegisterCopy = {
  emailLabel: string;
  emailPlaceholder: string;
  microLabel: string;
  setupBody: string;
  workspaceField: boolean;
  workspaceLabel?: string;
  workspacePlaceholder?: string;
  claim: string;
  privacy: string;
};

export const REGISTER_COPY: Readonly<Record<Register, RegisterCopy>> = {
  company: {
    emailLabel: "WORK EMAIL",
    emailPlaceholder: "you@yourcompany.com",
    microLabel: "Your organization",
    setupBody: "Two details and you are in. Both are yours to change later.",
    workspaceField: true,
    workspaceLabel: "Workspace name",
    workspacePlaceholder: "Northwind Group",
    claim: "One board. Every tool. Circle a few chats and ask.",
    privacy: "Share work with your organization when you choose.",
  },
  personal: {
    emailLabel: "EMAIL",
    emailPlaceholder: "you@example.com",
    microLabel: "Just you",
    setupBody: "One detail and you are in. Yours to change later.",
    workspaceField: false,
    claim: "Stop losing the chat where you worked it out.",
    privacy: "Pick a thread back up months later.",
  },
  edu: {
    emailLabel: "EMAIL",
    emailPlaceholder: "you@school.edu",
    microLabel: "Your school work",
    setupBody: "One detail and you are in. Yours to change later.",
    workspaceField: false,
    claim: "Your AI chats are where the thinking happened. Put them where the work is.",
    privacy: "Take your work with you when the term ends.",
  },
  partner: {
    emailLabel: "WORK EMAIL",
    emailPlaceholder: "you@yourpractice.com",
    microLabel: "Your practice",
    setupBody: "Two details and you are in. Both are yours to change later.",
    workspaceField: true,
    workspaceLabel: "Workspace name",
    workspacePlaceholder: "Harbor Practice",
    claim: "Every workboard in one place, with the work people shared next to it.",
    privacy: "You see what people share with you.",
  },
};

/**
 * No door signal. The page must not imply who they are, so the email field
 * says the least it can. Only `/auth` reads this today; the onboarding setup
 * screen always has a register from the confirmation redirect.
 */
export const NEUTRAL_COPY: RegisterCopy = {
  emailLabel: "EMAIL",
  emailPlaceholder: "you@example.com",
  microLabel: "Your workspace",
  setupBody: "One detail and you are in. Yours to change later.",
  workspaceField: false,
  claim: "Every AI conversation you've had, in one place, next to the work it produced.",
  privacy: "Bring your AI conversations into one workspace.",
};

export const REGISTER_SHARED_COPY = {
  setupTitle: "What should we call you?",
  nameLabel: "Your name",
  namePlaceholder: "Jordan Reyes",
  submit: "Create my workspace",
} as const;

/** Closed org.created.entry_door vocabulary. */
export const ENTRY_DOORS = ["intent", "edu_flag", "chooser", "invite"] as const;
export type EntryDoor = (typeof ENTRY_DOORS)[number];

