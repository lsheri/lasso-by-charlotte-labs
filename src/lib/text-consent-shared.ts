/**
 * 19 Nov 2026: a person agrees to receive text messages from Lasso. The pure rules of the public page at /texts and
 * of the server function that stores the agreement. Nothing here reads or writes anything.
 *
 * Privacy floor: a mobile number is stored in one place only, the message_consents table, which no browser can read.
 * It never goes into an event, a log line, an error message or PostHog. So nothing in this file returns a number
 * inside a message.
 */

/**
 * The words beside the tick box. The carrier registration quotes this sentence exactly, and each stored agreement
 * keeps a copy of what the person saw, so a change here is a new version: bump TEXT_CONSENT_VERSION with it.
 * A test pins the literal.
 */
export const TEXT_CONSENT_WORDING =
  "I agree to receive text messages from Lasso about proposals and projects I am asked to help with. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.";
export const TEXT_CONSENT_VERSION = "tc-v1";

export const NAME_MAX = 120;

export type TextConsentProblem = "name" | "phone" | "agree";
export type TextConsentInput = {
  name: string;
  phone: string;
  agreed: boolean;
  workspace?: string | null;
  /** The roster person a link names (19 Nov). Kept only if that person is in the link's workspace. */
  contact?: string | null;
};
export type TextConsentRecord = {
  name: string;
  phone: string;
  workspace: string | null;
  contact: string | null;
};
export type TextConsentCheck =
  { ok: true; record: TextConsentRecord } | { ok: false; problems: TextConsentProblem[] };

/** What the server answers. It never says whether a number was already on file. */
export type TextConsentResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "busy" | "unavailable"; problems?: TextConsentProblem[] };

/** A name as typed: control characters out, runs of space collapsed, trimmed. Empty or too long is no name. */
export function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/**
 * A United States or Canada mobile number in the one stored form, +1 and ten digits, or null. Lasso's sending number
 * reaches those two countries only, so a number from anywhere else is refused here instead of failing later.
 * Accepts the ways people write one: (206) 555-0142, 206.555.0142, +1 206 555 0142, 1-206-555-0142.
 */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const typed = value.trim();
  if (typed.length > 32) return null;
  // Only digits and the marks people put between them. A letter, an extension or a second plus is not a number.
  if (!/^\+?[\d\s().-]+$/.test(typed)) return null;
  let digits = typed.replace(/\D/g, "");
  if (typed.startsWith("+") && !digits.startsWith("1")) return null;
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  // North American numbering: area code and exchange each start 2 to 9.
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(digits)) return null;
  return `+1${digits}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** The workspace a link names, if it is shaped like one. Whether it exists is the server's question. */
export function cleanWorkspace(value: unknown): string | null {
  return typeof value === "string" && UUID.test(value.trim()) ? value.trim().toLowerCase() : null;
}

/** Every rule in one place, used by the page before it sends and by the server before it stores. */
export function checkTextConsent(
  input: Partial<Record<keyof TextConsentInput, unknown>> | null | undefined,
): TextConsentCheck {
  const name = cleanName(input?.name);
  const phone = normalizePhone(input?.phone);
  const problems: TextConsentProblem[] = [];
  if (!name) problems.push("name");
  if (!phone) problems.push("phone");
  // The tick is a deliberate act: only the boolean true counts, never a truthy string.
  if (input?.agreed !== true) problems.push("agree");
  if (!name || !phone || problems.length > 0) return { ok: false, problems };
  const workspace = cleanWorkspace(input?.workspace);
  // A person is named only together with their workspace; one without the other names nobody.
  return {
    ok: true,
    record: { name, phone, workspace, contact: workspace ? cleanWorkspace(input?.contact) : null },
  };
}

export const TEXT_CONSENT_COPY = {
  label: "Text messages",
  heading: "Get texts from Lasso",
  intro:
    // Liam, card Q-49, 19 Nov: "Yes, add the words", and "it must be Lasso helpful and not corporate stuck up".
    "A firm you work with uses Lasso to run its proposals and projects. If you agree, Lasso can text you when a firm asks for your part of a proposal, or when something you helped with moves, like a proposal you worked on being won. Only the moments that matter to you, never marketing.",
  nameLabel: "Your name",
  phoneLabel: "Mobile number",
  phoneHint: "United States or Canada. For example (206) 555-0142.",
  submit: "Agree to texts",
  sending: "Saving",
  legalBefore: "Read the",
  privacy: "privacy policy",
  legalBetween: "and the",
  terms: "terms of use",
  legalAfter: ". We never sell your number or share it for marketing.",
  problems: {
    name: "Enter your name.",
    phone: "Enter a United States or Canada mobile number, with its area code.",
    agree: "Tick the box to agree to receive texts.",
  } satisfies Record<TextConsentProblem, string>,
  failures: {
    invalid: "Check your name and number, then try again.",
    busy: "Too many tries from here. Wait a few minutes, then try again.",
    unavailable: "That did not save. Nothing was recorded. Try again in a moment.",
  } satisfies Record<Exclude<TextConsentResult, { ok: true }>["reason"], string>,
  doneHeading: "You are set",
  done: "You agreed to receive text messages from Lasso. Reply STOP to any message to opt out, or HELP for help.",
  doneNote: "You can close this page.",
} as const;
