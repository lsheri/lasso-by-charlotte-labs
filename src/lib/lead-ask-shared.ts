/**
 * 20 Nov 2026, Proposal Desk (Liam, Q-52: "Reply YES or NO to a real text"): asking a proposal's lead by text and
 * reading the reply. The pure rules: the words, the three reply words, what a delivery report means, and the one
 * line the Proposals page shows.
 *
 * Nothing here carries a phone number, and nothing here rates or times a person: the page says what happened to one
 * text, never how fast anyone answered.
 */

import { plainForSms, SMS_ONE_SEGMENT } from "./won-text-shared";

/** The most asks one workspace may send in a UTC day. */
export const ASK_DAILY_CAP = 10;
/** How long an ask waits for its reply. After this a reply is no longer matched to it, and the person may be asked again. */
export const ASK_WAIT_HOURS = 72;

const OPT_OUT = "Reply STOP to opt out.";

/** A first name as it can travel in a plain text. */
function firstName(full: string): string {
  return plainForSms(full).split(" ")[0] ?? "";
}

/**
 * The ask, word for word as filed with the carriers (sample 2 of the campaign). A workspace name that does not fit
 * whole in one text is left out, never cut.
 */
export function leadAskBody(input: { brandName: string; firmName: string; leadName: string; askerName: string }): string {
  const brand = plainForSms(input.brandName) || "Lasso";
  const lead = firstName(input.leadName) || "there";
  const asker = firstName(input.askerName) || "The team";
  const tail = `hi ${lead}, ${asker} would love you to lead a new proposal. Are you in? Reply YES or NO. ${OPT_OUT}`;
  const firm = plainForSms(input.firmName);
  const withFirm = `${brand} for ${firm}: ${tail}`;
  return firm && withFirm.length <= SMS_ONE_SEGMENT ? withFirm : `${brand}: ${tail}`;
}

export const REPLIES = ["yes", "no", "stop"] as const;
export type Reply = (typeof REPLIES)[number];

/** The words the carriers themselves treat as STOP. */
const STOP_WORDS = new Set(["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"]);

/**
 * What a reply means: YES, NO or STOP, in any case, with spaces around it or a full stop or exclamation mark after
 * it. Anything else is not a reply we act on, and is never stored.
 */
export function readReply(body: unknown): Reply | null {
  if (typeof body !== "string" || body.length > 200) return null;
  const word = body.trim().replace(/[\s.!]+$/u, "").replace(/^[\s.]+/u, "").toUpperCase();
  if (word === "YES") return "yes";
  if (word === "NO") return "no";
  return STOP_WORDS.has(word) ? "stop" : null;
}

export const TEXT_STATUSES = ["queued", "accepted", "sent", "delivered", "undelivered", "failed", "rejected", "expired", "opted_out", "practice"] as const;
export type TextStatus = (typeof TEXT_STATUSES)[number];

/** The status a delivery report stands for, or null for a report we do not act on. */
export function statusForReport(type: unknown): TextStatus | null {
  switch (type) {
    case "sms.accepted":
      return "accepted";
    case "sms.sent":
      return "sent";
    case "sms.delivered":
      return "delivered";
    case "sms.undelivered":
      return "undelivered";
    case "sms.failed":
      return "failed";
    case "sms.rejected":
      return "rejected";
    case "sms.expired":
      return "expired";
    default:
      return null;
  }
}

const NOT_ARRIVED: readonly TextStatus[] = ["undelivered", "failed", "rejected", "expired"];

/** Whether an ask is still waiting for its reply: sent, not answered, not lost, and inside the waiting time. */
export function isWaiting(ask: { status: string; reply: string | null; createdAt: string }, now: Date): boolean {
  if (ask.reply) return false;
  if (ask.status === "opted_out" || (NOT_ARRIVED as readonly string[]).includes(ask.status)) return false;
  const made = Date.parse(ask.createdAt);
  return Number.isFinite(made) && now.getTime() - made < ASK_WAIT_HOURS * 3_600_000;
}

/** The latest ask on a proposal, as the page draws it. Never a number, never how long anyone took. */
export type AskView = {
  /** The roster person asked, by name; empty for a demo workspace's demo number. */
  name: string;
  status: TextStatus;
  reply: Reply | null;
  /** A practice ask: nothing was sent. Demo workspaces only, while texting is not switched on. */
  practice: boolean;
  /** Still inside the waiting time with no reply. */
  waiting: boolean;
  /**
   * 21 Nov (D-82, QA H1 and N1): true when the ask last changed (its reply, else its delivery report, else when it was
   * sent) within the last day, by a window the server alone sets, so an admin's Home can list it under "Earlier". Sent
   * to admins only. No time leaves the server, so nothing can work out how long anyone took.
   */
  recent?: true;
};

export const ASK_COPY = {
  open: (name: string) => (name ? `Ask ${name} to lead` : "Ask the lead"),
  again: "Ask again",
  title: "Ask them to lead",
  helper: "One text, sent once you press Send. They answer by replying YES or NO, and can reply STOP at any time.",
  practiceHelper: "Texting is not connected in this app yet, so this is a practice ask. Nothing is sent to any phone. You can then answer it here as the lead would.",
  demoHelper: "This is a demo workspace, so the text goes to the demo number, not to the person picked.",
  send: "Send",
  sendPractice: "Start practice ask",
  sending: "Sending",
  cancel: "Cancel",
  loading: "Loading the words",
  /** Above the phone. Only a real ask reaches the person; a demo or practice ask shows what they would get. */
  gets: (name: string, real: boolean) => `${name.trim().split(/\s+/)[0] || "The lead"} ${real ? "gets" : "would get"}`,
  /* The row's one line. */
  saidYes: (name: string) => `${name || "The lead"} said yes`,
  saidNo: (name: string) => `${name || "The lead"} said no`,
  stopped: (name: string) => `${name || "The lead"} opted out of texts`,
  sentWaiting: "Asked by text. Waiting for a reply",
  deliveredWaiting: "Delivered. Waiting for a reply",
  notArrived: "The text did not arrive",
  /** QA M2: the carrier refused it, so nothing went out. Short form of `refused`. */
  notAccepted: "The text was not accepted, so nothing was sent",
  noReply: "Asked by text. No reply",
  practiceWaiting: "Practice ask. Nothing was sent",
  practiceTag: "Practice",
  practiceReply: "Answer as the lead would:",
  practiceYes: "YES",
  practiceNo: "NO",
  practiceStop: "STOP",
  practiceStopNote: "In a real text, STOP also ends their agreement to be texted.",
  /* Why nothing was sent. */
  notAllowed: "Only an admin or a lead can ask by text.",
  closed: "This proposal is already decided.",
  noLead: "Pick a lead first.",
  missing: "That person is not on this workspace's list any more. Pick a lead again.",
  notAgreed: (name: string) => `${name} has not agreed to texts, so nothing was sent. Copy their link under the People tab and send it to them.`,
  notAgreedYet: (name: string) => `${name} has not agreed to texts, so nothing will be sent. Copy their link under the People tab and send it to them.`,
  noDemoNumber: "No number is set for this demo workspace, so nothing was sent. An admin sets one under the People tab.",
  noDemoNumberYet: "No number is set for this demo workspace, so nothing will be sent. An admin sets one under the People tab.",
  notConnected: "Texting is not connected in this app yet, so nothing was sent.",
  notConnectedYet: "Texting is not connected in this app yet, so nothing will be sent.",
  alreadyWaiting: "They have already been asked and have not replied yet. Nothing was sent.",
  alreadyAnswered: (name: string) => `${name} has already answered. Nothing was sent.`,
  busy: "A text to this person is still waiting for an answer, so nothing was sent. Try again later.",
  capped: "That is the limit for asks today. Nothing was sent.",
  optedOut: "They have opted out of texts. Nothing was sent.",
  refused: "The text was not accepted, so nothing was sent. The number may still be awaiting carrier approval.",
  failed: "The text could not be sent. Try again in a moment.",
  notRecorded: "We could not record this, so nothing was sent.",
  notReady: "Asking by text is not set up in this workspace yet. Nothing was sent.",
  practiceOnly: "Practice replies are for practice asks in a demo workspace.",
  practiceGone: "There is no practice ask waiting on this proposal.",
} as const;

/** The one line a row shows for its latest ask. */
export function askLine(ask: AskView): string {
  if (ask.reply === "yes") return ASK_COPY.saidYes(ask.name);
  if (ask.reply === "no") return ASK_COPY.saidNo(ask.name);
  if (ask.reply === "stop" || ask.status === "opted_out") return ASK_COPY.stopped(ask.name);
  if (ask.status === "rejected") return ASK_COPY.notAccepted;
  if ((NOT_ARRIVED as readonly string[]).includes(ask.status)) return ASK_COPY.notArrived;
  if (ask.practice) return ASK_COPY.practiceWaiting;
  if (!ask.waiting) return ASK_COPY.noReply;
  return ask.status === "delivered" ? ASK_COPY.deliveredWaiting : ASK_COPY.sentWaiting;
}

/** What the workspace can do about texts, for the page. */
/**
 * 20 Nov 2026 (Liam, card Q-67): the one sheet where a lead is picked and asked. Short lines: the phone already
 * shows what goes out, so the words say only who, and where it goes.
 */
export const SHEET_COPY = {
  title: (client: string) => (client ? `Who leads ${client}?` : "Who leads this?"),
  confirmTitle: (name: string) => (name ? `Ask ${name}?` : "Ask the lead?"),
  ask: (name: string) => (name ? `Ask ${name}` : "Ask"),
  back: "Back",
  /** 21 Nov 2026: the sheet that opens straight after New proposal saves. Closing it leaves the proposal with no lead. */
  started: "Proposal started.",
  pickLater: "Pick later",
  pickFirst: "Pick someone to see their text",
  ledBefore: "Led before:",
  /** D-86 (Liam): said beside a person who has led nothing with us yet, so the partner is not left guessing. */
  noPast: "No past work with us yet",
  /** Where it goes, said once on the confirm. */
  goes: (mode: "real" | "demo" | "practice", name: string) =>
    mode === "practice"
      ? "Practice ask. Nothing is sent. You can answer it here as the lead would."
      : mode === "demo"
        ? `Demo workspace. This text goes to the demo number, not to ${name || "the lead"}.`
        : `One text to ${name || "the lead"}. They reply YES or NO, or STOP at any time.`,
  /**
   * Texting is not switched on. Said once on the list, in place of the line about where texts go, so nothing there
   * says or implies a text is sent. The confirm says the same through goes("practice").
   */
  off: (demo: boolean) =>
    demo
      ? "Texting is not connected in this app yet, so this is a practice ask. Nothing is sent to any phone."
      : "Texting is not connected in this app yet. Nothing is sent.",
  /** The words for this person did not arrive. Said before anyone can press Send, and it is not a failed text. */
  wordsFailed: "The text for this person could not be loaded, so nothing can be sent yet. Pick them again, or close this and try again.",
  /** The lead was not saved, so nothing was sent either. */
  notSaved: (problem: string) => `${problem} Nothing was sent.`,
  savedNotSent: (name: string, problem: string) => `${name || "The lead"} is saved as the lead. ${problem}`,
} as const;

export type TextsState = {
  /** A demo workspace: texts go to its demo number. */
  demo: boolean;
  /** Texting is switched on: an approved sender's settings are in place. */
  connected: boolean;
};

export type AskPreview =
  | { ok: true; words: string; name: string; mode: "real" | "demo" | "practice"; warning: string | null }
  | { ok: false; problem: string };

export type AskResult = { ok: true; practice: boolean } | { ok: false; problem: string };
export type PracticeReplyResult = { ok: true } | { ok: false; problem: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Loose = Record<string, unknown> | null | undefined;
const id = (value: unknown): string | null => (typeof value === "string" && UUID.test(value.trim()) ? value.trim() : null);

export type AskProposalInput = { profile_id: string | null; proposal_id: string };

export function askProposalInput(raw: { profile_id?: string | null | undefined; proposal_id: string }): AskProposalInput {
  const proposal = id((raw as Loose)?.["proposal_id"]);
  if (!proposal) throw new Error(ASK_COPY.failed);
  return { profile_id: id((raw as Loose)?.["profile_id"]), proposal_id: proposal };
}

export type AskPreviewInput = AskProposalInput & { lead_contact_id: string | null };

/** A preview may name a person who is not saved as the lead yet. Anything that is not an id is "the saved lead". */
export function askPreviewInput(raw: { profile_id?: string | null | undefined; proposal_id: string; lead_contact_id?: string | null | undefined }): AskPreviewInput {
  return { ...askProposalInput(raw), lead_contact_id: id((raw as Loose)?.["lead_contact_id"]) };
}

export type AskSendInput = AskProposalInput & { press_id: string };

export function askSendInput(raw: { profile_id?: string | null | undefined; proposal_id: string; press_id: string }): AskSendInput {
  const press = id((raw as Loose)?.["press_id"]);
  if (!press) throw new Error(ASK_COPY.failed);
  return { ...askProposalInput(raw), press_id: press };
}

export type PracticeReplyInput = AskProposalInput & { reply: Reply };

export function practiceReplyInput(raw: { profile_id?: string | null | undefined; proposal_id: string; reply: string }): PracticeReplyInput {
  const reply = (raw as Loose)?.["reply"];
  if (typeof reply !== "string" || !(REPLIES as readonly string[]).includes(reply)) throw new Error(ASK_COPY.failed);
  return { ...askProposalInput(raw), reply: reply as Reply };
}
