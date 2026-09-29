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
    privacy: "Nobody reads your threads. Your work is private to you until you share it.",
  },
  personal: {
    emailLabel: "EMAIL",
    emailPlaceholder: "you@example.com",
    microLabel: "Just you",
    setupBody: "One detail and you are in. Yours to change later.",
    workspaceField: false,
    claim: "Stop losing the chat where you worked it out.",
    privacy: "Nobody reads your threads.",
  },
  edu: {
    emailLabel: "EMAIL",
    emailPlaceholder: "you@school.edu",
    microLabel: "Your school work",
    setupBody: "One detail and you are in. Yours to change later.",
    workspaceField: false,
    claim: "Your AI chats are where the thinking happened. Put them where the work is.",
    privacy: "Not your professor, not your school.",
  },
  partner: {
    emailLabel: "WORK EMAIL",
    emailPlaceholder: "you@yourpractice.com",
    microLabel: "Your practice",
    setupBody: "Two details and you are in. Both are yours to change later.",
    workspaceField: true,
    workspaceLabel: "Workspace name",
    workspacePlaceholder: "Harbor Practice",
    claim: "Every engagement in one place, with the work people shared next to it.",
    privacy: "You see what people send you, and nothing else.",
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
  privacy: "Nobody reads your threads.",
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

/** Unit Y1: the four FlowPreview beats, one set per register. */
export type FlowPreviewStage = { label: string; body: string };

export const FLOW_PREVIEW_COPY: Readonly<Record<Register, readonly FlowPreviewStage[]>> = {
  company: [
    { label: "You work in your AI tools", body: "Claude, ChatGPT, Drive, meetings." },
    { label: "It flows into Lasso", body: "Only what you choose. Private on arrival." },
    { label: "You map it", body: "Give it an engagement and a workstream. It becomes a record." },
    { label: "A coach sees what you share", body: "Never your raw files. Only the shared view." },
  ],
  personal: [
    { label: "You work in your AI tools", body: "Claude, ChatGPT, Drive, your own notes." },
    { label: "It flows into Lasso", body: "Only what you choose. Private on arrival." },
    { label: "You file it", body: "Put it under one of your projects. It becomes part of your record." },
    { label: "The record stays yours", body: "Nothing leaves unless you choose to share it." },
  ],
  edu: [
    { label: "You work in your AI tools", body: "Claude, ChatGPT, Drive, lecture notes." },
    { label: "It flows into Lasso", body: "Only what you choose. Private on arrival." },
    { label: "You file it", body: "Put it under a class or project, next to the coursework it belongs to." },
    { label: "You choose what to share", body: "Nothing leaves your workspace by itself. Share one piece when you want to." },
  ],
  partner: [
    { label: "You set up the engagement", body: "A client, a cohort, the workstreams you will run." },
    { label: "People join with a link", body: "Their workspace stays theirs. Yours holds the engagement." },
    { label: "They share what they choose", body: "A board, a transcript, or nothing at all, at the depth they agreed to." },
    { label: "You coach from what arrived", body: "Never their raw files. Only what they sent you." },
  ],
};
