/**
 * 20 Nov 2026, Phase 2 of the chat pill build: "Set up a pilot". The rules a founder's form and the server share.
 * Pure: no database, no network. The server runs every check again; the form only says what is wrong sooner.
 */

/** A firm's name: what the workspace is called everywhere in the app. */
export const PILOT_NAME_MAX = 80;
export const PILOT_NAME_MIN = 2;
/** How long the first admin's invite stays open. */
export const PILOT_INVITE_DAYS = 14;

/** The settings key that marks a workspace made on this page, with when. The app never shows it. */
export const PILOT_SET_UP_KEY = "pilot_set_up_at";

/** No name for the admin: they type their own when they join, so nothing is kept that they did not give. */
export type PilotSetupInput = { firm_name: string; admin_email: string };

export type PilotSetupField = "firm_name" | "admin_email";

export type PilotSetupClean = { firmName: string; adminEmail: string };

export type PilotSetupResult =
  | {
      ok: true;
      orgId: string;
      orgName: string;
      /** The first admin's join link, built by the server. */
      joinUrl: string;
      /** Whether the invite email went: "not_configured" means copy the link and send it yourself. */
      emailed: "sent" | "not_configured" | "failed";
    }
  | { ok: false; reason: "invalid"; field: PilotSetupField }
  | { ok: false; reason: "exists" }
  | { ok: false; reason: "failed" }
  /** A step failed and the half-made workspace could not be removed either: it shows in the list as "No invite". */
  | { ok: false; reason: "stuck" };

export type PilotRow = {
  orgId: string;
  name: string;
  setUpAt: string;
  /** The first admin's address, as the invite holds it. Shown only to the founder. */
  inviteEmail: string | null;
  joined: boolean;
  /** Joined, or the invite is still open, or it ran out. */
  invite: "joined" | "open" | "expired" | "none";
  people: number;
};

const CONTROL = /[\u0000-\u001f\u007f]/;
// Invisible and direction-changing characters: dropped, so a lookalike of an existing firm cannot be made (QA of #286, L3).
const INVISIBLE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufeff]/g;
// One @, a dot in the domain, no spaces. The real proof is the person receiving the email.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function oneLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.replace(INVISIBLE, "").replace(/\s+/g, " ").trim();
  return CONTROL.test(trimmed) ? null : trimmed;
}

/** Cleans what the form sent, or names the first field that is wrong. */
export function cleanPilotInput(input: unknown): { ok: true; value: PilotSetupClean } | { ok: false; field: PilotSetupField } {
  const raw = (input ?? {}) as Partial<Record<PilotSetupField, unknown>>;
  const firmName = oneLine(raw.firm_name);
  if (!firmName || firmName.length < PILOT_NAME_MIN || firmName.length > PILOT_NAME_MAX || /[<>]/.test(firmName))
    return { ok: false, field: "firm_name" };
  const email = oneLine(raw.admin_email)?.toLowerCase() ?? "";
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, field: "admin_email" };
  return { ok: true, value: { firmName, adminEmail: email } };
}

/** Two names are the same workspace when they match ignoring case, spacing and a trailing full stop. */
export function sameFirmName(a: string, b: string): boolean {
  const key = (value: string) => value.replace(INVISIBLE, "").replace(/\s+/g, " ").trim().replace(/\.$/, "").toLowerCase();
  return key(a) === key(b);
}

/** The words on the page. No em dashes. */
export const PILOT_COPY = {
  title: "Set up a pilot",
  intro:
    "Makes a company workspace with clients turned on, and invites its first admin by email. They join, add their team and clients, and make their first proposal.",
  firmName: "Firm name",
  adminEmail: "First admin's email",
  submit: "Set up the pilot",
  working: "Setting up",
  invalid: {
    firm_name: `Type the firm's name, ${PILOT_NAME_MIN} to ${PILOT_NAME_MAX} characters.`,
    admin_email: "Type the admin's email address.",
  } satisfies Record<PilotSetupField, string>,
  exists: "A company workspace with that name already exists. Nothing was made.",
  failed: "The workspace could not be set up. Nothing was kept. Try again.",
  stuck: "The workspace could not be set up, and the half-made one could not be removed. It is in the list below as No invite; ask Claude to remove it before trying this name again.",
  done: (name: string) => `${name} is set up.`,
  emailed: {
    sent: "The invite email went to the admin.",
    not_configured: "Email is not set up here, so nothing was emailed. Copy the link and send it yourself.",
    failed: "The invite email did not go. Copy the link and send it yourself.",
  },
  copyLink: "Copy the join link",
  copied: "Copied",
  listTitle: "Pilots set up here",
  listEmpty: "No pilots have been set up from this page yet.",
  invite: { joined: "Admin joined", open: "Invite open", expired: "Invite ran out", none: "No invite" } satisfies Record<PilotRow["invite"], string>,
  refused: "This page is for Charlotte Labs only.",
} as const;
