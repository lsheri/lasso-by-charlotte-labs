/**
 * 20 Nov 2026, Proposal Desk (Liam, Q-52): asking a proposal's lead by text, and acting on what comes back.
 *
 * Two halves, both with their outside world injected so every rule is tested without a database or a network:
 *
 *  - A press (`askPreview`, `askLead`, `practiceReply`): an admin or a lead of the proposal's own workspace asks
 *    the picked lead. In a real workspace the text goes to that person only when they have a live agreement tied
 *    to their roster entry; no agreement, no send. A demo workspace sends to its demo number. Nothing is ever sent
 *    automatically.
 *  - What the sender posts back (`handleTextEvent`): delivery reports and replies. YES, NO and STOP are the only
 *    words acted on, and nothing else from a reply is kept.
 *
 * Every read and write names the workspace. A reply is matched through the agreements table (number, workspace,
 * roster person), so a reply can only ever land on an ask in a workspace where that number has agreed. When one
 * number has an ask waiting in two workspaces at once the reply is not guessed at: it lands on neither. To keep
 * that from happening, a second workspace is held from asking while the first ask waits.
 *
 * The number is read on the server at the moment of sending and handed straight to the sender. It is never
 * returned, logged, stored on a text's row or put in an event.
 *
 * Trying it before the carriers approve the number: in a demo workspace only, while texting is not switched on,
 * a press makes a practice ask (nothing is sent) and an admin or lead can answer it as the lead would. That answer
 * runs the same recogniser and the same write as a real reply. A practice answer can only touch a practice ask in
 * the caller's own demo workspace, and it never ends anyone's agreement.
 *
 * 20 Nov 2026, chat pill Phase 0 (Liam, D-97): "switched on" means able to send, not just settings in place. A
 * refusal from the provider pauses sending (text-readiness-shared.ts). While paused, a demo workspace gets practice
 * asks again, including for the press that met the refusal, and a real workspace is told "Texts start once our
 * number is approved. Nothing was sent." and may record the lead's answer by hand (`recordAnswer`). A recorded
 * answer is a practice row in a real workspace: nothing was sent, and the answer counts as the lead's.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { launchBrand } from "@/design/brand/brand";
import type { Database } from "@/integrations/supabase/types";

import {
  ASK_COPY,
  ASK_DAILY_CAP,
  ASK_WAIT_HOURS,
  isWaiting,
  leadAskBody,
  readReply,
  statusForReport,
  type AskPreview,
  type AskProposalInput,
  type AskResult,
  type AskSendInput,
  isRecordedAnswer,
  type PracticeReplyInput,
  type RecordAnswerInput,
  type PracticeReplyResult,
  type Reply,
  type TextStatus,
} from "./lead-ask-shared";
import { canManageRoster } from "./roster-shared";
import { senderRefusedRecently, textConfig, type TextConfig, type TextSendResult } from "./text-sender.server";
import { isE164 } from "./won-text-shared";

type Db = SupabaseClient<Database>;
type LooseDb = SupabaseClient;

export type AskCaller = { profileId: string; orgId: string; role: string; userId: string; name: string };

export type AskRow = {
  id: string;
  org_id: string;
  proposal_id: string;
  contact_id: string | null;
  to_demo: boolean;
  press_id: string;
  status: string;
  reply: string | null;
  created_at: string;
};

type AskEvent = "lead_ask.result" | "lead_ask.replied";

export type AskStore = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<AskCaller>;
  /** One proposal, read by the server. */
  proposal: (id: string) => Promise<{ id: string; org_id: string; status: string; lead_contact_id: string | null } | null>;
  /** The roster person's name, only if they are on this workspace's list. */
  leadName: (orgId: string, contactId: string) => Promise<string | null>;
  firmName: (orgId: string) => Promise<string>;
  brandName: () => string;
  demo: (orgId: string) => Promise<boolean>;
  /** The sender's settings, or null when they are not in place. */
  config: () => TextConfig | null;
  /** Whether a send was refused recently, which pauses sending: the sender is not ready. */
  refusedRecently: () => Promise<boolean>;
  /** The demo workspace's one number, or null. Server only. */
  demoNumber: (orgId: string) => Promise<string | null>;
  /** The number this roster person agreed with in this workspace, or null. Server only. */
  agreedNumber: (orgId: string, contactId: string) => Promise<string | null>;
  /** The asks on this proposal in this workspace, newest first. Null when they could not be read. */
  asks: (orgId: string, proposalId: string) => Promise<AskRow[] | null>;
  /** Whether an ask to this number is still waiting anywhere. Null when that could not be read. */
  waitingFor: (phone: string, now: Date) => Promise<boolean | null>;
  /** Asks this workspace has made since the start of the UTC day, practice asks left out. Null when unreadable. */
  askedToday: (orgId: string, now: Date) => Promise<number | null>;
  insert: (row: { id: string; org_id: string; proposal_id: string; contact_id: string | null; to_demo: boolean; press_id: string; sent_by: string; status: TextStatus }) => Promise<"made" | "exists" | "failed">;
  remove: (orgId: string, id: string) => Promise<void>;
  setStatus: (orgId: string, id: string, patch: { status: TextStatus; provider_id?: string | null }) => Promise<boolean>;
  /** Writes the reply on an ask that has none. False when it already had one or nothing matched. */
  setReply: (orgId: string, id: string, reply: Reply, at: Date) => Promise<boolean>;
  send: (config: TextConfig, message: { to: string; text: string; idempotencyKey: string; kind: string; ref: string }) => Promise<TextSendResult>;
  /** Ends every agreement for this number: the sender says they opted out. */
  stop: (phone: string) => Promise<"done" | "failed">;
  record: (who: { orgId: string; userId: string | null; profileId: string | null }, eventType: AskEvent, dims: Record<string, string>) => Promise<void>;
  now: () => Date;
  newId: () => string;
};

type Target = {
  caller: AskCaller;
  proposalId: string;
  contactId: string;
  name: string;
  words: string;
  demo: boolean;
  config: TextConfig | null;
};

/** The sender's settings only when it can send now. */
async function readyConfig(store: AskStore): Promise<TextConfig | null> {
  const config = store.config();
  if (!config) return null;
  return (await store.refusedRecently()) ? null : config;
}

/**
 * A second press id for the practice ask that stands in for a refused one. Worked out from the first, so a retry of
 * the same press finds the same practice ask instead of making another.
 */
export function practicePressId(pressId: string): string {
  const head = Number.parseInt(pressId.charAt(0), 16);
  return `${((head + 8) % 16).toString(16)}${pressId.slice(1)}`;
}

/** The checks a preview and a press share. */
async function target(store: AskStore, proposalId: string, candidate?: string | null): Promise<Target | { problem: string }> {
  const caller = await store.caller();
  if (!canManageRoster(caller.role)) return { problem: ASK_COPY.notAllowed };
  const row = await store.proposal(proposalId);
  // Another workspace's proposal and one that does not exist read the same.
  if (!row || row.org_id !== caller.orgId) return { problem: ASK_COPY.notAllowed };
  if (row.status !== "open") return { problem: ASK_COPY.closed };
  // A preview may look at a person before they are saved as the lead. A press never does: it asks the saved lead.
  const contactId = candidate ?? row.lead_contact_id;
  if (!contactId) return { problem: ASK_COPY.noLead };
  const name = await store.leadName(caller.orgId, contactId);
  if (!name) return { problem: ASK_COPY.missing };
  const words = leadAskBody({ brandName: store.brandName(), firmName: await store.firmName(caller.orgId), leadName: name, askerName: caller.name });
  return { caller, proposalId: row.id, contactId, name, words, demo: await store.demo(caller.orgId), config: await readyConfig(store) };
}

/** The exact words, and anything that would stop the text, before a press. Writes nothing and sends nothing. */
export async function askPreview(store: AskStore, input: AskProposalInput & { lead_contact_id?: string | null }): Promise<AskPreview> {
  const state = await target(store, input.proposal_id, input.lead_contact_id ?? null);
  if ("problem" in state) return { ok: false, problem: state.problem };
  const { caller, name, words } = state;
  if (state.demo && !state.config) return { ok: true, words, name, mode: "practice", warning: null };
  if (!state.config) return { ok: true, words, name, mode: "real", warning: ASK_COPY.notConnectedYet };
  if (state.demo) {
    const number = await store.demoNumber(caller.orgId);
    return { ok: true, words, name, mode: "demo", warning: isE164(number) ? null : ASK_COPY.noDemoNumberYet };
  }
  const number = await store.agreedNumber(caller.orgId, state.contactId);
  return { ok: true, words, name, mode: "real", warning: isE164(number) ? null : ASK_COPY.notAgreedYet(name) };
}

const mode = (state: Target, practice: boolean): string => (practice ? "practice" : state.demo ? "demo" : "real");

/** One press of Send. */
export async function askLead(store: AskStore, input: AskSendInput): Promise<AskResult> {
  const state = await target(store, input.proposal_id);
  if ("problem" in state) return { ok: false, problem: state.problem };
  const { caller, config } = state;
  const practice = state.demo && !config;
  if (!practice && !config) return { ok: false, problem: ASK_COPY.notConnected };

  // Who it goes to. Read here, used once below, never kept.
  let to: string | null = null;
  if (!practice) {
    const number = state.demo ? await store.demoNumber(caller.orgId) : await store.agreedNumber(caller.orgId, state.contactId);
    if (!isE164(number)) return { ok: false, problem: state.demo ? ASK_COPY.noDemoNumber : ASK_COPY.notAgreed(state.name) };
    to = number;
  }

  const now = store.now();
  const asks = await store.asks(caller.orgId, state.proposalId);
  if (asks === null) return { ok: false, problem: ASK_COPY.notReady };
  // The same press means the same press id at the same person. An id that comes back for someone else is not a
  // repeat: it falls through to the insert, which refuses it, so one person's row never answers for another.
  const same = asks.find((ask) => ask.press_id === input.press_id && (state.demo ? ask.to_demo : ask.contact_id === state.contactId));
  let rowId = same?.id ?? null;
  if (same && same.status !== "queued") {
    // The same press again: say what it came to, send nothing more.
    if (same.status === "practice") return { ok: true, practice: true };
    // A demo press the provider refused stood in for by a practice ask: the retry says the same.
    if (same.status === "rejected" && state.demo && asks.some((ask) => ask.press_id === practicePressId(input.press_id) && ask.status === "practice")) return { ok: true, practice: true };
    if (same.status === "opted_out") return { ok: false, problem: ASK_COPY.optedOut };
    return ["accepted", "sent", "delivered"].includes(same.status) ? { ok: true, practice: false } : { ok: false, problem: ASK_COPY.failed };
  }

  if (!same) {
    // Once texting is on, a practice ask left over from before neither blocks a real ask nor counts as an answer.
    // An answer recorded by hand in a real workspace always counts: it is the lead's answer, heard another way.
    const toThisPerson = asks.filter((ask) => (practice || ask.status !== "practice" || isRecordedAnswer(ask)) && (state.demo ? ask.to_demo : ask.contact_id === state.contactId));
    if (toThisPerson.some((ask) => isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now))) return { ok: false, problem: ASK_COPY.alreadyWaiting };
    // In a real workspace a person who has answered is not asked again about the same proposal.
    if (!state.demo && toThisPerson.some((ask) => ask.reply)) return { ok: false, problem: ASK_COPY.alreadyAnswered(state.name) };
    if (to) {
      const waiting = await store.waitingFor(to, now);
      if (waiting === null) return { ok: false, problem: ASK_COPY.notRecorded };
      if (waiting) return { ok: false, problem: ASK_COPY.busy };
    }
    rowId = store.newId();
    const made = await store.insert({
      id: rowId,
      org_id: caller.orgId,
      proposal_id: state.proposalId,
      contact_id: state.demo ? null : state.contactId,
      to_demo: state.demo,
      press_id: input.press_id,
      sent_by: caller.profileId,
      status: practice ? "practice" : "queued",
    });
    // If the press cannot be recorded nothing is sent, so the daily limit can never be passed by a recording fault.
    if (made === "failed") return { ok: false, problem: ASK_COPY.notRecorded };
    if (made === "exists") return { ok: false, problem: ASK_COPY.alreadyWaiting };
    if (practice) {
      await safely(() => store.record(who(caller), "lead_ask.result", { mode: "practice", outcome: "accepted" }));
      return { ok: true, practice: true };
    }
    const today = await store.askedToday(caller.orgId, now);
    if (today === null || today < 1 || today > ASK_DAILY_CAP) {
      await store.remove(caller.orgId, rowId);
      if (today !== null && today > ASK_DAILY_CAP) {
        await safely(() => store.record(who(caller), "lead_ask.result", { mode: mode(state, false), outcome: "capped" }));
        return { ok: false, problem: ASK_COPY.capped };
      }
      return { ok: false, problem: ASK_COPY.notRecorded };
    }
  }
  if (!rowId || !to || !config) return { ok: false, problem: ASK_COPY.notRecorded };

  const sent = await store.send(config, { to, text: state.words, idempotencyKey: `lead-ask/${rowId}`, kind: "lead_ask", ref: rowId });
  if (sent.outcome === "refused" || sent.outcome === "failed") {
    // A status and a short code only. The recipient, the sender and the words never reach a log.
    console.error(`[lead-ask] ${sent.outcome} status=${sent.status ?? "none"} code=${sent.outcome === "refused" ? (sent.code ?? "none") : "none"}`);
  }
  const status: TextStatus = sent.outcome === "accepted" ? "accepted" : sent.outcome === "opted_out" ? "opted_out" : sent.outcome === "refused" ? "rejected" : "failed";
  await store.setStatus(caller.orgId, rowId, { status, ...(sent.outcome === "accepted" && sent.id ? { provider_id: sent.id } : {}) });
  // The sender says this person opted out: their agreement ends here too, so no later press tries again.
  if (sent.outcome === "opted_out" && !state.demo) await store.stop(to);
  await safely(() => store.record(who(caller), "lead_ask.result", { mode: mode(state, false), outcome: sent.outcome }));
  if (sent.outcome === "accepted") return { ok: true, practice: false };
  // The provider refused: the number is not accepted yet, so sending pauses. A demo workspace gets the practice ask
  // this press would have made had the pause already been known, so the demo still goes on.
  if (sent.outcome === "refused" && state.demo) return practiceInstead(store, state, input.press_id);
  return { ok: false, problem: sent.outcome === "opted_out" ? ASK_COPY.optedOut : sent.outcome === "refused" ? ASK_COPY.refused : ASK_COPY.failed };
}

/** The practice ask that stands in for a refused one in a demo workspace. Nothing is sent. */
async function practiceInstead(store: AskStore, state: Target, pressId: string): Promise<AskResult> {
  const { caller } = state;
  const made = await store.insert({
    id: store.newId(),
    org_id: caller.orgId,
    proposal_id: state.proposalId,
    contact_id: null,
    to_demo: true,
    press_id: practicePressId(pressId),
    sent_by: caller.profileId,
    status: "practice",
  });
  if (made === "failed") return { ok: false, problem: ASK_COPY.refused };
  if (made === "made") await safely(() => store.record(who(caller), "lead_ask.result", { mode: "practice", outcome: "accepted" }));
  return { ok: true, practice: true };
}

const who = (caller: AskCaller) => ({ orgId: caller.orgId, userId: caller.userId, profileId: caller.profileId });

async function safely(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    /* a recording fault never changes what happened to the text */
  }
}

/**
 * A practice answer, typed by an admin or lead of a demo workspace in place of the lead. It runs the same
 * recogniser as a real reply and the same write. It can only land on a practice ask in the caller's own workspace.
 */
export async function practiceReply(store: AskStore, input: PracticeReplyInput): Promise<PracticeReplyResult> {
  const caller = await store.caller();
  if (!canManageRoster(caller.role) || !(await store.demo(caller.orgId))) return { ok: false, problem: ASK_COPY.practiceOnly };
  // Practice ends the moment texting is switched on: a practice ask left over from before can no longer be answered.
  if (await readyConfig(store)) return { ok: false, problem: ASK_COPY.practiceOnly };
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: ASK_COPY.practiceOnly };
  const reply = readReply(input.reply);
  if (!reply) return { ok: false, problem: ASK_COPY.practiceOnly };
  const asks = await store.asks(caller.orgId, row.id);
  const now = store.now();
  const waiting = (asks ?? []).find((ask) => ask.status === "practice" && isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now));
  if (!waiting) return { ok: false, problem: ASK_COPY.practiceGone };
  if (!(await store.setReply(caller.orgId, waiting.id, reply, now))) return { ok: false, problem: ASK_COPY.practiceGone };
  await safely(() => store.record(who(caller), "lead_ask.replied", { mode: "practice", reply }));
  return { ok: true };
}

/**
 * An answer an admin or lead heard some other way (a call, a message), recorded on the proposal while texts have not
 * started. Real workspaces only: a demo workspace has practice asks. YES or NO only. One answer per lead per proposal,
 * as with a text: someone who has answered is not asked or recorded again. Nothing is sent and no agreement changes.
 */
export async function recordAnswer(store: AskStore, input: RecordAnswerInput): Promise<PracticeReplyResult> {
  const caller = await store.caller();
  if (!canManageRoster(caller.role)) return { ok: false, problem: ASK_COPY.notAllowed };
  const row = await store.proposal(input.proposal_id);
  if (!row || row.org_id !== caller.orgId) return { ok: false, problem: ASK_COPY.notAllowed };
  if (await store.demo(caller.orgId)) return { ok: false, problem: ASK_COPY.recordOnly };
  if (await readyConfig(store)) return { ok: false, problem: ASK_COPY.recordOnly };
  if (row.status !== "open") return { ok: false, problem: ASK_COPY.closed };
  const contactId = row.lead_contact_id;
  if (!contactId) return { ok: false, problem: ASK_COPY.noLead };
  const name = await store.leadName(caller.orgId, contactId);
  if (!name) return { ok: false, problem: ASK_COPY.missing };
  const asks = await store.asks(caller.orgId, row.id);
  if (asks === null) return { ok: false, problem: ASK_COPY.notRecorded };
  const now = store.now();
  const same = asks.find((ask) => ask.press_id === input.press_id && ask.contact_id === contactId);
  // The same press again, already recorded: say it went through, write nothing more.
  if (same && same.reply) return isRecordedAnswer(same) ? { ok: true } : { ok: false, problem: ASK_COPY.alreadyAnswered(name) };
  const toThisPerson = asks.filter((ask) => ask.contact_id === contactId && !ask.to_demo);
  if (toThisPerson.some((ask) => ask.reply)) return { ok: false, problem: ASK_COPY.alreadyAnswered(name) };
  // A real text still waiting is answered by its reply, not by hand.
  if (toThisPerson.some((ask) => ask.status !== "practice" && isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now))) return { ok: false, problem: ASK_COPY.alreadyWaiting };
  let rowId = same?.id ?? null;
  if (!rowId) {
    rowId = store.newId();
    const made = await store.insert({ id: rowId, org_id: caller.orgId, proposal_id: row.id, contact_id: contactId, to_demo: false, press_id: input.press_id, sent_by: caller.profileId, status: "practice" });
    if (made !== "made") return { ok: false, problem: ASK_COPY.notRecorded };
  }
  if (!(await store.setReply(caller.orgId, rowId, input.reply, now))) {
    // Never leave an unanswered row behind: it would read as an ask.
    if (!same) await store.remove(caller.orgId, rowId);
    return { ok: false, problem: ASK_COPY.notRecorded };
  }
  await safely(() => store.record(who(caller), "lead_ask.replied", { mode: "recorded", reply: input.reply }));
  return { ok: true };
}

/* ---------------------------------------------------------------------------
 * What the sender posts back
 * ------------------------------------------------------------------------- */

export type TextEvent = { type: string; timestamp: string | null; data: Record<string, unknown> };

export type InboundStore = {
  /** Our own sending number, or null when texting is not switched on. */
  ourNumber: () => string | null;
  /** A real message arrived from this number: it proves the person holds it. */
  confirm: (phone: string) => Promise<void>;
  /** The asks still open for a reply from this number, across the workspaces where it has agreed. Null when unreadable. */
  openAsks: (phone: string, since: Date) => Promise<AskRow[] | null>;
  setReply: (orgId: string, id: string, reply: Reply, at: Date) => Promise<boolean>;
  /** Ends every agreement for this number and clears it as any demo number. */
  stop: (phone: string) => Promise<"done" | "failed">;
  /** Writes a delivery report on the text it belongs to, unless a later report is already there. */
  report: (match: { providerId: string; ref: string | null }, status: TextStatus, at: Date) => Promise<void>;
  record: (who: { orgId: string; userId: string | null; profileId: string | null }, eventType: AskEvent, dims: Record<string, string>) => Promise<void>;
  now: () => Date;
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function eventTime(event: TextEvent, now: Date): Date {
  const parsed = event.timestamp ? Date.parse(event.timestamp) : NaN;
  // A report cannot be from the future; one with no readable time counts as now.
  return new Date(Number.isFinite(parsed) ? Math.min(parsed, now.getTime()) : now.getTime());
}

/** A STOP, however it reached us: the asks waiting on this number are closed and every agreement for it ends. */
async function stopped(store: InboundStore, phone: string, at: Date): Promise<"done" | "retry"> {
  // Read before the agreements end, because the agreements are how the asks are found.
  const open = await store.openAsks(phone, new Date(at.getTime() - ASK_WAIT_HOURS * 3_600_000));
  if ((await store.stop(phone)) === "failed") return "retry";
  for (const ask of (open ?? []).filter((row) => row.status !== "practice")) {
    if (await store.setReply(ask.org_id, ask.id, "stop", at)) {
      await safely(() => store.record({ orgId: ask.org_id, userId: null, profileId: null }, "lead_ask.replied", { mode: ask.to_demo ? "demo" : "real", reply: "stop" }));
    }
  }
  return "done";
}

/**
 * Acts on one verified event. "retry" asks the sender to deliver it again later; everything here is safe to run
 * twice. An event type we do not know is ignored, never an error.
 */
export async function handleTextEvent(store: InboundStore, event: TextEvent): Promise<"done" | "retry"> {
  const now = store.now();
  const at = eventTime(event, now);
  const ours = store.ourNumber();
  const data = event.data;

  if (event.type === "sms.received") {
    const from = text(data["from"]);
    // Only messages to our own number, from a full phone number.
    if (!ours || text(data["to"]) !== ours || !isE164(from)) return "done";
    await store.confirm(from);
    // The sender's page says the event "carries the body" without naming the field, so each likely shape is read.
    const words = data["text"] ?? data["body"];
    const reply = readReply(words && typeof words === "object" ? (words as Record<string, unknown>)["body"] : words);
    if (!reply) return "done";
    if (reply === "stop") return stopped(store, from, at);
    const open = await store.openAsks(from, new Date(now.getTime() - ASK_WAIT_HOURS * 3_600_000));
    if (open === null) return "retry";
    const waiting = open.filter((ask) => ask.status !== "practice" && isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now));
    // One waiting ask: the reply is its answer. None, or more than one: we do not guess, and nothing is stored.
    const ask = waiting.length === 1 ? waiting[0] : undefined;
    if (!ask) return "done";
    if (await store.setReply(ask.org_id, ask.id, reply, at)) {
      await safely(() => store.record({ orgId: ask.org_id, userId: null, profileId: null }, "lead_ask.replied", { mode: ask.to_demo ? "demo" : "real", reply }));
    }
    return "done";
  }

  if (event.type === "sms_suppression.created") {
    const phone = text(data["destination"]);
    if (!ours || text(data["originator"]) !== ours || !isE164(phone)) return "done";
    return stopped(store, phone, at);
  }

  const status = statusForReport(event.type);
  if (!status) return "done";
  const providerId = text(data["sms_id"]);
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(providerId)) return "done";
  const metadata = data["metadata"] && typeof data["metadata"] === "object" ? (data["metadata"] as Record<string, unknown>) : {};
  const ref = text(metadata["text_id"]);
  await store.report({ providerId, ref: UUID.test(ref) ? ref : null }, status, at);
  return "done";
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

const ASK_COLUMNS = "id, org_id, proposal_id, contact_id, to_demo, press_id, status, reply, created_at";

export function startOfUtcDay(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

/** The asks open for a reply from one number: found through its live agreements and through demo numbers. */
export async function openAsksFor(admin: LooseDb, phone: string, since: Date): Promise<AskRow[] | null> {
  const [agreed, demos] = await Promise.all([
    admin.from("message_consents").select("org_id, roster_contact_id").eq("phone_e164", phone).is("revoked_at", null).limit(50),
    admin.from("demo_text_recipients").select("org_id").eq("phone_e164", phone).limit(50),
  ]);
  if (agreed.error || demos.error) return null;
  const rows: AskRow[] = [];
  for (const pair of (agreed.data ?? []) as { org_id: string | null; roster_contact_id: string | null }[]) {
    if (!pair.org_id || !pair.roster_contact_id) continue;
    const { data, error } = await admin.from("proposal_texts").select(ASK_COLUMNS).eq("kind", "lead_ask").eq("org_id", pair.org_id).eq("contact_id", pair.roster_contact_id).is("reply", null).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(20);
    if (error) return null;
    rows.push(...((data ?? []) as AskRow[]));
  }
  for (const demo of (demos.data ?? []) as { org_id: string }[]) {
    const { data, error } = await admin.from("proposal_texts").select(ASK_COLUMNS).eq("kind", "lead_ask").eq("org_id", demo.org_id).eq("to_demo", true).is("reply", null).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(20);
    if (error) return null;
    rows.push(...((data ?? []) as AskRow[]));
  }
  return rows;
}

async function writeReply(admin: LooseDb, orgId: string, id: string, reply: Reply, at: Date): Promise<boolean> {
  const { data, error } = await admin.from("proposal_texts").update({ reply, replied_at: at.toISOString() }).eq("id", id).eq("org_id", orgId).is("reply", null).select("id");
  return !error && (data ?? []).length === 1;
}

async function recordAsk(admin: Db, target: { orgId: string; userId: string | null; profileId: string | null }, eventType: AskEvent, dims: Record<string, string>): Promise<void> {
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(admin, { eventType, orgId: target.orgId, userId: target.userId, profileId: target.profileId, dims });
}

export type AskContext = { supabase: Db; userId: string };

export async function realAskStore(context: AskContext, profileId: string | null): Promise<AskStore> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const admin = supabaseAdmin as unknown as LooseDb;
  const { data: me } = await supabaseAdmin.from("profiles").select("display_name").eq("id", profile.id).maybeSingle();
  const caller: AskCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role, userId: context.userId, name: typeof me?.display_name === "string" ? me.display_name : "" };
  return {
    caller: async () => caller,
    async proposal(id) {
      const { data } = await admin.from("proposals").select("id, org_id, status, lead_contact_id").eq("id", id).maybeSingle();
      return (data as { id: string; org_id: string; status: string; lead_contact_id: string | null } | null) ?? null;
    },
    async leadName(orgId, contactId) {
      const { data, error } = await admin.from("roster_contacts").select("full_name").eq("id", contactId).eq("org_id", orgId).maybeSingle();
      const name = (data as { full_name?: unknown } | null)?.full_name;
      return !error && typeof name === "string" && name.trim() ? name.trim() : null;
    },
    async firmName(orgId) {
      const { data } = await supabaseAdmin.from("orgs").select("name").eq("id", orgId).maybeSingle();
      return typeof data?.name === "string" ? data.name : "";
    },
    brandName: () => launchBrand().name,
    async demo(orgId) {
      const { data } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      const { isDemoWorkspace } = await import("./demo-text-number-shared");
      return isDemoWorkspace(data?.settings);
    },
    config: () => textConfig(),
    refusedRecently: () => senderRefusedRecently(admin),
    async demoNumber(orgId) {
      const { demoRecipient } = await import("./demo-text-number.server");
      return demoRecipient(supabaseAdmin, orgId);
    },
    async agreedNumber(orgId, contactId) {
      const { liveConsentRecords } = await import("./text-consent.server");
      return (await liveConsentRecords()).numberFor(orgId, contactId);
    },
    async asks(orgId, proposalId) {
      const { data, error } = await admin.from("proposal_texts").select(ASK_COLUMNS).eq("kind", "lead_ask").eq("org_id", orgId).eq("proposal_id", proposalId).order("created_at", { ascending: false }).limit(50);
      return error ? null : ((data ?? []) as AskRow[]);
    },
    async waitingFor(phone, now) {
      const open = await openAsksFor(admin, phone, new Date(now.getTime() - ASK_WAIT_HOURS * 3_600_000));
      if (open === null) return null;
      return open.some((ask) => ask.status !== "practice" && isWaiting({ status: ask.status, reply: ask.reply, createdAt: ask.created_at }, now));
    },
    async askedToday(orgId, now) {
      const { count, error } = await admin.from("proposal_texts").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("kind", "lead_ask").neq("status", "practice").or("status.neq.rejected,provider_id.not.is.null").gte("created_at", startOfUtcDay(now));
      return error || typeof count !== "number" ? null : count;
    },
    async insert(row) {
      const { error } = await admin.from("proposal_texts").insert({ ...row, kind: "lead_ask" });
      if (!error) return "made";
      return (error as { code?: string }).code === "23505" ? "exists" : "failed";
    },
    async remove(orgId, id) {
      await admin.from("proposal_texts").delete().eq("id", id).eq("org_id", orgId);
    },
    async setStatus(orgId, id, patch) {
      const { error } = await admin.from("proposal_texts").update({ ...patch, status_at: new Date().toISOString() }).eq("id", id).eq("org_id", orgId);
      return !error;
    },
    setReply: (orgId, id, reply, at) => writeReply(admin, orgId, id, reply, at),
    async send(config, message) {
      const { sendText } = await import("./text-sender.server");
      return sendText(config, message);
    },
    async stop(phone) {
      const { liveConsentRecords } = await import("./text-consent.server");
      return (await liveConsentRecords()).stopNumber(phone);
    },
    record: (target, eventType, dims) => recordAsk(supabaseAdmin, target, eventType, dims),
    now: () => new Date(),
    newId: () => crypto.randomUUID(),
  };
}

type NumberRecords = { confirmNumber: (phone: string) => Promise<void>; stopNumber: (phone: string) => Promise<"done" | "failed"> };

/**
 * The store behind the public address, on a given database. It has no signed-in person: everything it touches is
 * found from the event, through the agreements table. Built from its parts so the tests run the real queries.
 */
export function inboundStoreOn(
  admin: LooseDb,
  parts: { numbers: NumberRecords; ourNumber: () => string | null; record: InboundStore["record"]; now?: () => Date },
): InboundStore {
  return {
    ourNumber: parts.ourNumber,
    confirm: (phone) => parts.numbers.confirmNumber(phone),
    openAsks: (phone, since) => openAsksFor(admin, phone, since),
    setReply: (orgId, id, reply, at) => writeReply(admin, orgId, id, reply, at),
    async stop(phone) {
      if ((await parts.numbers.stopNumber(phone)) === "failed") return "failed";
      // A demo workspace's typed number is an agreement too, and STOP ends it the same way.
      const { error } = await admin.from("demo_text_recipients").delete().eq("phone_e164", phone);
      return error ? "failed" : "done";
    },
    async report(match, status, at) {
      const stamp = at.toISOString();
      const patch = { status, status_at: stamp };
      // A later report already on the row wins: reports do not arrive in order.
      const byId = await admin.from("proposal_texts").update(patch).eq("provider_id", match.providerId).neq("status", "practice").or(`status_at.is.null,status_at.lt.${stamp}`).select("id");
      if (byId.error || (byId.data ?? []).length > 0 || !match.ref) return;
      // The send's reply never reached us, so the row has no sender id yet: our own id travelled with the message.
      await admin.from("proposal_texts").update({ ...patch, provider_id: match.providerId }).eq("id", match.ref).is("provider_id", null).neq("status", "practice");
    },
    record: parts.record,
    now: parts.now ?? (() => new Date()),
  };
}

export async function realInboundStore(): Promise<InboundStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { liveConsentRecords } = await import("./text-consent.server");
  return inboundStoreOn(supabaseAdmin as unknown as LooseDb, {
    numbers: await liveConsentRecords(),
    ourNumber: () => textConfig()?.from ?? null,
    record: (target, eventType, dims) => recordAsk(supabaseAdmin, target, eventType, dims),
  });
}

/** The server functions' handlers. The functions file only wires them up, so these are what the tests call. */
export const askHandlers = {
  async preview(context: AskContext, data: AskProposalInput & { lead_contact_id?: string | null }): Promise<AskPreview> {
    return askPreview(await realAskStore(context, data.profile_id), data);
  },
  async send(context: AskContext, data: AskSendInput): Promise<AskResult> {
    return askLead(await realAskStore(context, data.profile_id), data);
  },
  async practiceReply(context: AskContext, data: PracticeReplyInput): Promise<PracticeReplyResult> {
    return practiceReply(await realAskStore(context, data.profile_id), data);
  },
  async recordAnswer(context: AskContext, data: RecordAnswerInput): Promise<PracticeReplyResult> {
    return recordAnswer(await realAskStore(context, data.profile_id), data);
  },
};
