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
 * named and the sender behind the text is never named. A long firm name is shortened so the text stays one segment.
 */
export function wonTextBody(input: { brandName: string; firmName: string }): string {
  const brand = plainForSms(input.brandName) || "Lasso";
  const tail = `the proposal you helped with has been won, and the team board is ready. ${OPT_OUT}`;
  const firm = plainForSms(input.firmName);
  const withFirm = `${brand} for ${firm}: ${tail}`;
  if (firm && withFirm.length <= SMS_ONE_SEGMENT) return withFirm;
  const room = SMS_ONE_SEGMENT - `${brand} for : ${tail}`.length;
  const short = firm.slice(0, Math.max(0, room)).trim();
  return short ? `${brand} for ${short}: ${tail}` : `${brand}: ${tail}`;
}

/** A full international number: a plus, then 8 to 15 digits, the first not zero. */
export function isE164(value: unknown): value is string {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}

export type WonTextStatus =
  /** Nothing to show: not an admin, not the workspace whose lead agreed to texts, not won, or nobody to text. */
  | { show: false }
  | { show: true; connected: boolean; needsNumber: boolean; preview: string };

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
