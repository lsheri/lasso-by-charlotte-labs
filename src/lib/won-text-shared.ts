/**
 * 19 Nov, Proposal Desk, first live slice (Liam, D-37 and D-39): one text to the lead when a proposal is won.
 *
 * The pure rules. Tonight exactly one person has agreed to be texted, and their number lives only in a server secret:
 * it is never an input, never stored in the database, never shown on a page and never put in an event or a log line.
 * So nothing in this file, and nothing a caller can send, carries a phone number.
 */

/** The most texts one workspace may send in a UTC day. A demo button must not become a way to pester someone. */
export const WON_TEXT_DAILY_CAP = 3;

/** One segment of a plain text. The words below stay inside it so the cost and the look are known. */
export const SMS_ONE_SEGMENT = 160;

export const WON_TEXT_CHANNELS = ["sms"] as const;
export type WonTextChannel = (typeof WON_TEXT_CHANNELS)[number];

/** What the press came to. Recorded as a dimension; none of these says who the text was for. */
export const WON_TEXT_OUTCOMES = ["accepted", "opted_out", "capped", "refused", "failed"] as const;
export type WonTextOutcome = (typeof WON_TEXT_OUTCOMES)[number];

/**
 * 20 Nov (Liam): the same news drawn three ways, side by side. Only the text is real. Email comes later and RCS is
 * coming soon; both are pictures of what the lead would see and neither sends anything.
 */
export const MESSAGE_EXAMPLES_COPY = {
  heading: "How the lead hears",
  text: "Text",
  textState: "Sent today",
  email: "Email",
  emailState: "Later",
  rcs: "RCS",
  rcsState: "Coming soon",
  subject: "The proposal you helped with has been won",
  emailBody: "Good news. The team board is ready for you. Open it to see the brief and the first documents.",
  emailFoot: "You are getting this because you agreed to hear about proposals you help with. Unsubscribe at any time.",
  rcsSender: "Verified sender",
  rcsTitle: "Proposal won",
  rcsBody: "Good news. The proposal you helped with has been won, and the team board is ready for you.",
  rcsYes: "Open the team board",
  rcsNo: "Not now",
  note: "Email and RCS are examples of what is coming. Only the text is sent.",
} as const;

export const WON_TEXT_COPY = {
  open: "Text the lead",
  title: "The text the lead will get",
  helper: "One text, sent once you press Send. They can reply STOP at any time.",
  send: "Send",
  sending: "Sending",
  cancel: "Cancel",
  sent: "Sent. It is on its way to the lead's phone.",
  /** Shown under the words before a press, while no approved number is connected. */
  awaiting: "The number is awaiting carrier approval. Send will not send anything yet.",
  notConnected: "The number is awaiting carrier approval, so nothing was sent.",
  /** No recipient is set for this demo workspace. Shown before a press and as the answer to one. */
  noNumber: "No number is set for this demo workspace, so nothing will be sent. An admin sets one on the Proposals page, under People.",
  /** A real workspace, and no lead was picked on the proposal. */
  noLead: "No lead was picked on this proposal, so there is nobody to text.",
  /** A real workspace, and the picked lead has no live agreement. */
  notAgreed: (name: string) => `${name} has not agreed to texts, so nothing will be sent. Copy their link under People on the Proposals page and send it to them.`,
  optedOut: "They have opted out of texts. Nothing was sent.",
  capped: "That is the limit for texts today. Nothing was sent.",
  notWon: "Mark this proposal as won first.",
  refused: "The text was not accepted, so nothing was sent. The number may still be awaiting carrier approval.",
  failed: "The text could not be sent. Try again in a moment.",
  notRecorded: "We could not record this, so nothing was sent.",
} as const;

/** The plain line a person reads for each way a press can end without a text going out. */
export const WON_TEXT_PROBLEMS: Record<Exclude<WonTextOutcome, "accepted">, string> = {
  opted_out: WON_TEXT_COPY.optedOut,
  capped: WON_TEXT_COPY.capped,
  refused: WON_TEXT_COPY.refused,
  failed: WON_TEXT_COPY.failed,
};

// The basic GSM-7 letters, digits and marks. Anything else (curly quotes, long dashes, emoji) would turn the whole
// text into the wide encoding and split it into more segments, so a name carrying one is reduced first.
const GSM_BASIC = /^[A-Za-z0-9 @$_!"#%&'()*+,\-./:;<=>?\n]*$/;

/** A workspace name as it can travel in a plain text: accents folded, anything else outside the alphabet dropped. */
export function plainForSms(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .split("")
    .filter((char) => GSM_BASIC.test(char))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

const OPT_OUT = "Reply STOP to opt out.";

/**
 * The words. The product's name comes from the brand module and the firm's name is the workspace's own; no client is
 * named and the sender behind the text is never named. A firm name that does not fit whole in one segment is left out, never cut mid-word.
 */
export function wonTextBody(input: { brandName: string; firmName: string }): string {
  const brand = plainForSms(input.brandName) || "Lasso";
  // Liam, card Q-50, 19 Nov: "Yes, use the friendlier text". The carrier filing quotes these words exactly.
  const tail = `good news. The proposal you helped with has been won, and the team board is ready for you. ${OPT_OUT}`;
  const firm = plainForSms(input.firmName);
  const withFirm = `${brand} for ${firm}: ${tail}`;
  // A name is never cut: when it does not fit whole in one segment, the text goes without it.
  return firm && withFirm.length <= SMS_ONE_SEGMENT ? withFirm : `${brand}: ${tail}`;
}

/** A full international number: a plus, then 8 to 15 digits, the first not zero. */
export function isE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export type WonTextStatus =
  /** Nothing to show: not an admin, not the workspace whose lead agreed to texts, not won, or nobody to text. */
  | { show: false }
  | { show: true; connected: boolean; needsNumber: boolean; preview: string; /** A real workspace with nobody to text: the plain reason. */ blocked?: string | undefined };

export type WonTextResult = { ok: true } | { ok: false; problem: string };

export type WonTextBoardInput = { profile_id: string | null; engagement_id: string };
export type WonTextSendInput = WonTextBoardInput & { press_id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Loose = Record<string, unknown> | null | undefined;
const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** A board and, optionally, which of the caller's profiles is asking. Nothing else is read from the input. */
export function wonTextBoardInput(input: { engagement_id: string; profile_id?: string | null | undefined }): WonTextBoardInput {
  const loose = input as Loose;
  const board = text(loose?.["engagement_id"]);
  if (!UUID.test(board)) throw new Error("Unknown board.");
  const profile = text(loose?.["profile_id"]);
  return { engagement_id: board, profile_id: UUID.test(profile) ? profile : null };
}

/** The same, plus one id per opened preview, so a double click or a retry is the same press and sends once. */
export function wonTextSendInput(input: { engagement_id: string; press_id: string; profile_id?: string | null | undefined }): WonTextSendInput {
  const press = text((input as Loose)?.["press_id"]);
  if (!UUID.test(press)) throw new Error("Unknown press.");
  return { ...wonTextBoardInput(input), press_id: press };
}
