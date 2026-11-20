/**
 * 20 Nov 2026, Proposal Desk (Liam, D-50): the one phone number a DEMO workspace's won-proposal text goes to. An
 * admin of a demo workspace types it before a demo, ticks that the person agreed, and can change or clear it.
 *
 * Real workspaces never have this: there, a person agrees on the public page with their own number and nobody types
 * a number into the app. The server refuses it outside demo workspaces, and so does the database.
 *
 * The number is write-only from the browser. After saving, the page learns only that a number is set, its last two
 * digits and when it was set. The number is never in an event, a log, an error or a reply.
 */

export const DEMO_NUMBER_COPY = {
  title: "Demo text number",
  line: "This demo workspace sends its won-proposal text to one phone. Enter it before a demo. It is never shown again after saving.",
  label: "Mobile number (United States or Canada)",
  hint: "415 555 0123",
  agreed: "This person has agreed to get this text",
  save: "Save number",
  saving: "Saving",
  change: "Change",
  clear: "Clear",
  clearing: "Clearing",
  cancel: "Cancel",
  none: "No number is set. Text the lead will send nothing.",
  set: (lastTwo: string, when: string) => `A number is set, ending in ${lastTwo}${when ? `, since ${when}` : ""}.`,
  saved: "Saved.",
  cleared: "Cleared. Text the lead will send nothing until a number is set.",
  problems: {
    number: "Enter a ten-digit United States or Canada mobile number.",
    agreed: "Tick the box to confirm the person agreed.",
    notHere: "A typed number is for demo workspaces only.",
    failed: "That could not be saved. Nothing changed. Try again in a moment.",
  },
} as const;

/** United States and Canada only: +1, an area code and an exchange that do not start with 0 or 1. Matches the database's own check. */
const NANP = /^\+1[2-9]\d{2}[2-9]\d{6}$/;

/** A typed number as +1XXXXXXXXXX, or null. Spaces, dots, dashes and brackets are fine; letters and other countries are not. */
export function demoNumber(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length > 40) return null;
  const trimmed = raw.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const full = trimmed.startsWith("+") ? `+${digits}` : digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : "";
  return NANP.test(full) ? full : null;
}

/** A workspace carrying the demo marker in its settings. */
export function isDemoWorkspace(settings: unknown): boolean {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  const record = settings as Record<string, unknown>;
  return record["type"] === "company" && "demo_firm" in record && Boolean(record["demo_firm"]);
}

export type DemoNumberStatus =
  /** Not an admin, or not a demo workspace: nothing is drawn. */
  | { show: false }
  | { show: true; set: false }
  | { show: true; set: true; lastTwo: string; setAt: string | null };

export type DemoNumberResult = { ok: true; status: DemoNumberStatus } | { ok: false; problem: string };

type Loose = Record<string, unknown> | null | undefined;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const profile = (raw: unknown): string | null => {
  const value = (raw as Loose)?.["profile_id"];
  return typeof value === "string" && UUID.test(value) ? value : null;
};

export type DemoNumberProfileInput = { profile_id: string | null };
export function demoNumberProfileInput(raw: { profile_id?: string | null | undefined }): DemoNumberProfileInput {
  return { profile_id: profile(raw) };
}

/** What a save carries. The checks run in the handler so a bad number gets a plain line, not a thrown error. */
export type DemoNumberSaveInput = DemoNumberProfileInput & { phone: string; agreed: boolean };
export function demoNumberSaveInput(raw: { profile_id?: string | null | undefined; phone: string; agreed: boolean }): DemoNumberSaveInput {
  const loose = raw as Loose;
  const phone = loose?.["phone"];
  return { profile_id: profile(raw), phone: typeof phone === "string" ? phone.slice(0, 40) : "", agreed: loose?.["agreed"] === true };
}
