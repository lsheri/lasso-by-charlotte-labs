// 20 Nov, Proposal Desk: asking a lead by text and reading the reply. The words as filed, the three reply words,
// every rule of a press for each role and each kind of workspace, the practice path, what the sender posts back,
// and that a reply for one firm can never touch another, even when one phone number has agreed in both.
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

import { EVENT_DIM_KEYS, guardServerEventDims } from "@/lib/event-dim-allowlist";
import { ASK_COPY, ASK_DAILY_CAP, ASK_WAIT_HOURS, askLine, askPreviewInput, askProposalInput, askSendInput, isWaiting, leadAskBody, practiceReplyInput, readReply, statusForReport, type AskView } from "@/lib/lead-ask-shared";
import { askLead, askPreview, handleTextEvent, inboundStoreOn, practiceReply, type AskCaller, type AskRow, type AskStore } from "@/lib/lead-ask.server";
import { consentRecords } from "@/lib/text-consent.server";
import { handleTextEventRequest, memoryLimiter, type TextEventDeps } from "@/lib/text-events.server";
import { sendText, type TextConfig, type TextSendResult } from "@/lib/text-sender.server";
import { SMS_ONE_SEGMENT } from "@/lib/won-text-shared";

const ORG_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROPOSAL = "00000001-0000-4000-8000-000000000001";
const LEAD = "00000002-0000-4000-8000-000000000001";
const PRESS = "00000003-0000-4000-8000-000000000001";
const PRESS_2 = "00000003-0000-4000-8000-000000000002";
const PHONE = "+12065550142";
const OTHER_PHONE = "+12065550177";
const OURS = "+14255550100";
const CONFIG: TextConfig = { apiKey: "bk_us1_testkey12345", from: OURS, host: "https://us1.platform.bird.com" };
const NOW = new Date("2026-11-20T12:00:00Z");
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

afterEach(() => vi.restoreAllMocks());

describe("the words", () => {
  it("are the ask as filed with the carriers, word for word", () => {
    expect(leadAskBody({ brandName: "Lasso", firmName: "Kestrel Bay Advisory", leadName: "Christy Johnson", askerName: "Maren Hollis" })).toBe(
      "Lasso for Kestrel Bay Advisory: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.",
    );
  });

  it("fit one text, never cut a workspace name, and survive missing names", () => {
    const long = leadAskBody({ brandName: "Lasso", firmName: "The Extraordinarily Long Named Advisory Partnership of the Pacific Northwest", leadName: "Christy", askerName: "Maren" });
    expect(long).toBe("Lasso: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.");
    expect(long.length).toBeLessThanOrEqual(SMS_ONE_SEGMENT);
    expect(leadAskBody({ brandName: "", firmName: "", leadName: "", askerName: "" })).toBe("Lasso: hi there, The team would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.");
    expect(leadAskBody({ brandName: "Lasso", firmName: "Åsa & Søn", leadName: "Zoë Müller-Lang", askerName: "José" })).toMatch(/^[\x20-\x7e]+$/);
  });

  it("have no long dash anywhere in the copy", () => {
    const all = JSON.stringify(ASK_COPY) + ASK_COPY.notAgreed("x") + ASK_COPY.saidYes("x") + ASK_COPY.open("x");
    expect(all).not.toMatch(/[—–]/);
    expect(all).not.toMatch(/bird/i);
  });
});

describe("reading a reply", () => {
  it.each([
    ["YES", "yes"], ["yes", "yes"], [" Yes ", "yes"], ["Yes.", "yes"], ["YES!", "yes"], ["yes .", "yes"], ["\nyes\n", "yes"],
    ["NO", "no"], ["no.", "no"], [" No ", "no"],
    ["STOP", "stop"], ["stop", "stop"], ["Stop.", "stop"], ["STOPALL", "stop"], ["unsubscribe", "stop"], ["Cancel", "stop"], ["END", "stop"], ["quit", "stop"],
  ])("%j is %s", (body, expected) => {
    expect(readReply(body)).toBe(expected);
  });

  it.each(["", "yes please", "no thanks", "maybe", "y", "n", "yess", "YES NO", "stop it", "call me", "👍", "x".repeat(300), null, undefined, 1, { text: "YES" }])("%j is not a reply we act on", (body) => {
    expect(readReply(body)).toBeNull();
  });

  it("maps the sender's delivery reports and ignores everything else", () => {
    expect(["sms.accepted", "sms.sent", "sms.delivered", "sms.undelivered", "sms.failed", "sms.rejected", "sms.expired"].map(statusForReport)).toEqual(["accepted", "sent", "delivered", "undelivered", "failed", "rejected", "expired"]);
    expect(["sms.received", "sms.clicked", "email.delivered", "", null, 4].map(statusForReport)).toEqual([null, null, null, null, null, null]);
  });
});

describe("the one line on the page", () => {
  const view = (over: Partial<AskView>): AskView => ({ name: "Christy Johnson", status: "accepted", reply: null, practice: false, waiting: true, ...over });

  it("says said yes, said no, delivered, or did not arrive", () => {
    expect(askLine(view({ reply: "yes" }))).toBe("Christy Johnson said yes");
    expect(askLine(view({ reply: "no" }))).toBe("Christy Johnson said no");
    expect(askLine(view({ reply: "stop" }))).toBe("Christy Johnson opted out of texts");
    expect(askLine(view({ status: "delivered" }))).toBe("Delivered. Waiting for a reply");
    expect(askLine(view({ status: "sent" }))).toBe("Asked by text. Waiting for a reply");
    for (const status of ["undelivered", "failed", "rejected", "expired"] as const) expect(askLine(view({ status, waiting: false }))).toBe("The text did not arrive");
    expect(askLine(view({ waiting: false }))).toBe("Asked by text. No reply");
    expect(askLine(view({ status: "practice", practice: true }))).toBe("Practice ask. Nothing was sent");
    expect(askLine(view({ name: "", reply: "yes" }))).toBe("The lead said yes");
  });

  it("never times or scores anyone", () => {
    const lines = [view({ reply: "yes" }), view({ reply: "no" }), view({ status: "delivered" }), view({ waiting: false })].map(askLine).join(" ");
    expect(lines).not.toMatch(/\d|minute|hour|day|fast|slow|late|quick/i);
  });

  it("an ask waits 72 hours, and not at all once answered or lost", () => {
    expect(ASK_WAIT_HOURS).toBe(72);
    expect(isWaiting({ status: "accepted", reply: null, createdAt: hoursAgo(71) }, NOW)).toBe(true);
    expect(isWaiting({ status: "accepted", reply: null, createdAt: hoursAgo(73) }, NOW)).toBe(false);
    expect(isWaiting({ status: "delivered", reply: "yes", createdAt: hoursAgo(1) }, NOW)).toBe(false);
    for (const status of ["failed", "undelivered", "rejected", "expired", "opted_out"]) expect(isWaiting({ status, reply: null, createdAt: hoursAgo(1) }, NOW)).toBe(false);
    expect(isWaiting({ status: "accepted", reply: null, createdAt: "junk" }, NOW)).toBe(false);
  });
});

describe("inputs", () => {
  it("take ids only, and nothing that could be a phone number", () => {
    expect(askSendInput({ proposal_id: PROPOSAL, press_id: PRESS, profile_id: null, phone: PHONE, to: PHONE } as never)).toEqual({ profile_id: null, proposal_id: PROPOSAL, press_id: PRESS });
    expect(() => askProposalInput({ proposal_id: "1 or 1=1" })).toThrow();
    expect(() => askSendInput({ proposal_id: PROPOSAL, press_id: "again" })).toThrow();
    expect(practiceReplyInput({ proposal_id: PROPOSAL, reply: "yes" })).toEqual({ profile_id: null, proposal_id: PROPOSAL, reply: "yes" });
    expect(() => practiceReplyInput({ proposal_id: PROPOSAL, reply: "YES please" })).toThrow();
  });
});

/* ---------------------------------------------------------------------------
 * A press
 * ------------------------------------------------------------------------- */

type World = {
  role: string;
  orgId: string;
  demo: boolean;
  config: TextConfig | null;
  proposal: { id: string; org_id: string; status: string; lead_contact_id: string | null } | null;
  roster: Record<string, string>;
  agreed: Record<string, string>;
  demoNumber: string | null;
  rows: (AskRow & { provider_id?: string | null })[];
  /** Asks waiting on this number in some other workspace. */
  waitingElsewhere: boolean | null;
  insertWorks: boolean;
  countWorks: boolean;
  send: TextSendResult;
  madeToday: number;
};

function world(over: Partial<World> = {}) {
  const w: World = {
    role: "admin", orgId: ORG_A, demo: false, config: CONFIG,
    proposal: { id: PROPOSAL, org_id: ORG_A, status: "open", lead_contact_id: LEAD },
    roster: { [`${ORG_A}/${LEAD}`]: "Christy Johnson" },
    agreed: { [`${ORG_A}/${LEAD}`]: PHONE },
    demoNumber: null, rows: [], waitingElsewhere: false, insertWorks: true, countWorks: true, send: { outcome: "accepted", id: "sms_0123456789" }, madeToday: 0,
    ...over,
  };
  const sends: { to: string; text: string; idempotencyKey: string; kind: string; ref: string }[] = [];
  const events: { event: string; dims: Record<string, string>; who: unknown }[] = [];
  const stops: string[] = [];
  let next = 0;
  const caller: AskCaller = { profileId: "p1", orgId: w.orgId, role: w.role, userId: "u1", name: "Maren Hollis" };
  const store: AskStore = {
    caller: async () => caller,
    proposal: async (id) => (w.proposal && w.proposal.id === id ? w.proposal : null),
    leadName: async (orgId, contactId) => w.roster[`${orgId}/${contactId}`] ?? null,
    firmName: async () => "Kestrel Bay Advisory",
    brandName: () => "Lasso",
    demo: async () => w.demo,
    config: () => w.config,
    demoNumber: async (orgId) => (orgId === w.orgId ? w.demoNumber : null),
    agreedNumber: async (orgId, contactId) => w.agreed[`${orgId}/${contactId}`] ?? null,
    asks: async (orgId, proposalId) => w.rows.filter((row) => row.org_id === orgId && row.proposal_id === proposalId),
    waitingFor: async () => w.waitingElsewhere,
    askedToday: async (orgId) => (w.countWorks ? w.madeToday + w.rows.filter((row) => row.org_id === orgId && row.status !== "practice").length : null),
    insert: async (row) => {
      if (!w.insertWorks) return "failed";
      if (w.rows.some((existing) => existing.proposal_id === row.proposal_id && existing.press_id === row.press_id)) return "exists";
      w.rows.unshift({ ...row, reply: null, created_at: NOW.toISOString() });
      return "made";
    },
    remove: async (orgId, id) => {
      w.rows = w.rows.filter((row) => !(row.id === id && row.org_id === orgId));
    },
    setStatus: async (orgId, id, patch) => {
      const row = w.rows.find((candidate) => candidate.id === id && candidate.org_id === orgId);
      if (row) Object.assign(row, patch);
      return Boolean(row);
    },
    setReply: async (orgId, id, reply) => {
      const row = w.rows.find((candidate) => candidate.id === id && candidate.org_id === orgId && !candidate.reply);
      if (row) row.reply = reply;
      return Boolean(row);
    },
    send: async (_config, message) => {
      sends.push(message);
      return w.send;
    },
    stop: async (phone) => {
      stops.push(phone);
      return "done";
    },
    record: async (who, event, dims) => {
      events.push({ event, dims, who });
    },
    now: () => NOW,
    newId: () => `row-${++next}`,
  };
  return { w, store, sends, events, stops };
}

const press = { proposal_id: PROPOSAL, profile_id: null, press_id: PRESS };

// 20 Nov 2026, QA S1: what a press id may and may not stand for.
describe("a press id belongs to one press at one person", () => {
  const LEAD_B = "00000002-0000-4000-8000-000000000002";
  const PHONE_B = "+12065550143";
  const two = (over: Partial<World> = {}) =>
    world({
      roster: { [`${ORG_A}/${LEAD}`]: "Christy Johnson", [`${ORG_A}/${LEAD_B}`]: "Tomasz Wieczorek" },
      agreed: { [`${ORG_A}/${LEAD}`]: PHONE, [`${ORG_A}/${LEAD_B}`]: PHONE_B },
      ...over,
    });
  const toB = (w: World) => (w.proposal = { id: PROPOSAL, org_id: ORG_A, status: "open", lead_contact_id: LEAD_B });

  it("plain retry: the same id after a failed send replays the failure and sends nothing; a new id tries again", async () => {
    const { w, store, sends } = two({ send: { outcome: "failed", status: null } });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.failed });
    w.send = { outcome: "accepted", id: "sms_2" };
    // This is what the live dialog does today: one id for the whole open dialog.
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.failed });
    expect(sends).toHaveLength(1);
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: true, practice: false });
    expect(sends).toHaveLength(2);
    expect(sends[1]!.to).toBe(PHONE);
  });

  it("the first send to A fails, then B is picked: a new id sends to B, B's words, on B's own row", async () => {
    const { w, store, sends } = two({ send: { outcome: "failed", status: null } });
    expect((await askLead(store, press)).ok).toBe(false);
    toB(w);
    w.send = { outcome: "accepted", id: "sms_2" };
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: true, practice: false });
    expect(sends[1]).toMatchObject({ to: PHONE_B });
    expect(sends[1]!.text).toContain("hi Tomasz,");
    expect(w.rows.find((row) => row.press_id === PRESS_2)).toMatchObject({ contact_id: LEAD_B, status: "accepted" });
    expect(w.rows.find((row) => row.press_id === PRESS)).toMatchObject({ contact_id: LEAD, status: "failed" });
  });

  it("A's send went through and the answer was lost, then B is picked: a new id sends to B", async () => {
    const { w, store, sends } = two();
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    toB(w);
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: true, practice: false });
    expect(sends.map((sent) => sent.to)).toEqual([PHONE, PHONE_B]);
    expect(w.rows.find((row) => row.press_id === PRESS_2)).toMatchObject({ contact_id: LEAD_B });
  });

  it("a queued row left over for A, then B is picked: a new id sends to B on B's row, and A's row is untouched", async () => {
    const { w, store, sends } = two();
    w.rows.push({ id: "left", org_id: ORG_A, proposal_id: PROPOSAL, contact_id: LEAD, to_demo: false, press_id: PRESS, sent_by: "p1", status: "queued", reply: null, created_at: NOW.toISOString() } as never);
    toB(w);
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: true, practice: false });
    expect(sends).toHaveLength(1);
    expect(sends[0]).toMatchObject({ to: PHONE_B });
    expect(sends[0]!.ref).not.toBe("left");
    expect(w.rows.find((row) => row.id === "left")).toMatchObject({ contact_id: LEAD, status: "queued" });
  });

  it.each([
    ["failed", { outcome: "failed", status: null }],
    ["accepted", { outcome: "accepted", id: "sms_1" }],
  ] as const)("an old sheet that reuses A's id (%s) for B is refused: B is not texted and A's row never answers for B", async (_name, first) => {
    const { w, store, sends } = two({ send: first as TextSendResult });
    await askLead(store, press);
    toB(w);
    w.send = { outcome: "accepted", id: "sms_2" };
    const again = await askLead(store, press);
    expect(again.ok).toBe(false);
    expect(sends).toHaveLength(1);
    expect(sends.some((sent) => sent.to === PHONE_B)).toBe(false);
    expect(w.rows).toHaveLength(1);
  });

  it("a queued row for A is never used to text B under the same id", async () => {
    const { w, store, sends } = two();
    w.rows.push({ id: "left", org_id: ORG_A, proposal_id: PROPOSAL, contact_id: LEAD, to_demo: false, press_id: PRESS, sent_by: "p1", status: "queued", reply: null, created_at: NOW.toISOString() } as never);
    toB(w);
    expect((await askLead(store, press)).ok).toBe(false);
    expect(sends).toHaveLength(0);
  });
});

describe("a press in a real workspace", () => {
  it.each(["admin", "lead"])("an %s sends the filed words to the picked lead's agreed number, once", async (role) => {
    const { w, store, sends, events } = world({ role });
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    expect(sends).toEqual([{ to: PHONE, text: "Lasso for Kestrel Bay Advisory: hi Christy, Maren would love you to lead a new proposal. Are you in? Reply YES or NO. Reply STOP to opt out.", idempotencyKey: "lead-ask/row-1", kind: "lead_ask", ref: "row-1" }]);
    expect(w.rows[0]).toMatchObject({ org_id: ORG_A, proposal_id: PROPOSAL, contact_id: LEAD, to_demo: false, status: "accepted", provider_id: "sms_0123456789", sent_by: "p1" });
    expect(events).toEqual([{ event: "lead_ask.result", dims: { mode: "real", outcome: "accepted" }, who: { orgId: ORG_A, userId: "u1", profileId: "p1" } }]);
    // The number is in the send and nowhere else: not on the row, not in an event, not in the answer.
    expect(JSON.stringify([w.rows, events])).not.toContain(PHONE.slice(1));
  });

  it.each(["manager", "analyst", "coach", "member", "guest", ""])("a %s cannot ask, and nothing is read or sent", async (role) => {
    const { store, sends, w } = world({ role });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.notAllowed });
    expect(await askPreview(store, press)).toEqual({ ok: false, problem: ASK_COPY.notAllowed });
    expect(sends).toHaveLength(0);
    expect(w.rows).toHaveLength(0);
  });

  it("no agreement, no send, and the screen says so plainly before and after the press", async () => {
    const { store, sends, w } = world({ agreed: {} });
    const preview = await askPreview(store, press);
    expect(preview).toMatchObject({ ok: true, mode: "real", name: "Christy Johnson", warning: ASK_COPY.notAgreedYet("Christy Johnson") });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.notAgreed("Christy Johnson") });
    expect(sends).toHaveLength(0);
    expect(w.rows).toHaveLength(0);
  });

  it("an agreement in another workspace does not count", async () => {
    const { store, sends } = world({ agreed: { [`${ORG_B}/${LEAD}`]: PHONE } });
    expect(await askLead(store, press)).toMatchObject({ ok: false, problem: ASK_COPY.notAgreed("Christy Johnson") });
    expect(sends).toHaveLength(0);
  });

  it("a stored value that is not a full phone number is never sent to", async () => {
    for (const bad of ["2065550142", "+1206", "christy", ""]) {
      const { store, sends } = world({ agreed: { [`${ORG_A}/${LEAD}`]: bad } });
      expect((await askLead(store, press)).ok).toBe(false);
      expect(sends).toHaveLength(0);
    }
  });

  it("another workspace's proposal reads the same as one that does not exist", async () => {
    const other = world({ proposal: { id: PROPOSAL, org_id: ORG_B, status: "open", lead_contact_id: LEAD } });
    const missing = world({ proposal: null });
    expect(await askLead(other.store, press)).toEqual(await askLead(missing.store, press));
    expect(await askLead(other.store, press)).toEqual({ ok: false, problem: ASK_COPY.notAllowed });
    expect(other.sends).toHaveLength(0);
  });

  it("refuses a decided proposal, one with no lead, and a lead no longer on the list", async () => {
    for (const status of ["won", "lost"]) expect(await askLead(world({ proposal: { id: PROPOSAL, org_id: ORG_A, status, lead_contact_id: LEAD } }).store, press)).toEqual({ ok: false, problem: ASK_COPY.closed });
    expect(await askLead(world({ proposal: { id: PROPOSAL, org_id: ORG_A, status: "open", lead_contact_id: null } }).store, press)).toEqual({ ok: false, problem: ASK_COPY.noLead });
    expect(await askLead(world({ roster: {} }).store, press)).toEqual({ ok: false, problem: ASK_COPY.missing });
  });

  it("says texting is not switched on, and sends nothing, before the number is approved", async () => {
    const { store, sends, w } = world({ config: null });
    expect(await askPreview(store, press)).toMatchObject({ ok: true, mode: "real", warning: ASK_COPY.notConnectedYet });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.notConnected });
    expect(sends).toHaveLength(0);
    // A real workspace never gets a practice ask.
    expect(w.rows).toHaveLength(0);
  });

  it("the same press twice sends once", async () => {
    const { store, sends, w } = world();
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    expect(sends).toHaveLength(1);
    expect(w.rows).toHaveLength(1);
  });

  it("a press whose row was made but whose send never finished retries with the same key", async () => {
    const { store, sends, w } = world();
    w.rows.push({ id: "row-old", org_id: ORG_A, proposal_id: PROPOSAL, contact_id: LEAD, to_demo: false, press_id: PRESS, status: "queued", reply: null, created_at: NOW.toISOString() });
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    expect(sends.map((sent) => sent.idempotencyKey)).toEqual(["lead-ask/row-old"]);
    expect(w.rows).toHaveLength(1);
  });

  it("a second ask while the first waits is refused, and so is asking someone who already answered", async () => {
    const { store, sends, w } = world();
    await askLead(store, press);
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: false, problem: ASK_COPY.alreadyWaiting });
    w.rows[0]!.reply = "no";
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: false, problem: ASK_COPY.alreadyAnswered("Christy Johnson") });
    expect(sends).toHaveLength(1);
  });

  it("asks again after a text that did not arrive", async () => {
    const { store, sends, w } = world();
    await askLead(store, press);
    w.rows[0]!.status = "undelivered";
    expect(await askLead(store, { ...press, press_id: PRESS_2 })).toEqual({ ok: true, practice: false });
    expect(sends).toHaveLength(2);
  });

  it("holds back while a text to the same number waits in another workspace, so a reply is never ambiguous", async () => {
    const { store, sends, w } = world({ waitingElsewhere: true });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.busy });
    expect(sends).toHaveLength(0);
    expect(w.rows).toHaveLength(0);
    expect((await askLead(world({ waitingElsewhere: null }).store, press)).ok).toBe(false);
  });

  it("stops at the workspace's daily limit, counted per workspace", async () => {
    expect(ASK_DAILY_CAP).toBe(10);
    const last = world({ madeToday: ASK_DAILY_CAP - 1 });
    expect(await askLead(last.store, press)).toEqual({ ok: true, practice: false });
    const over = world({ madeToday: ASK_DAILY_CAP });
    expect(await askLead(over.store, press)).toEqual({ ok: false, problem: ASK_COPY.capped });
    expect(over.sends).toHaveLength(0);
    // The refused press leaves no row, so it does not count against tomorrow or block a later ask.
    expect(over.w.rows).toHaveLength(0);
    expect(over.events).toEqual([{ event: "lead_ask.result", dims: { mode: "real", outcome: "capped" }, who: expect.anything() }]);
  });

  it("sends nothing when the press cannot be recorded or today's count cannot be read", async () => {
    const noRow = world({ insertWorks: false });
    expect(await askLead(noRow.store, press)).toEqual({ ok: false, problem: ASK_COPY.notRecorded });
    const noCount = world({ countWorks: false });
    expect(await askLead(noCount.store, press)).toEqual({ ok: false, problem: ASK_COPY.notRecorded });
    expect(noRow.sends.length + noCount.sends.length).toBe(0);
    expect(noCount.w.rows).toHaveLength(0);
  });

  it.each([
    [{ outcome: "opted_out" }, "opted_out", ASK_COPY.optedOut],
    [{ outcome: "refused", status: 422, code: "SMSDestinationNotEnabled" }, "rejected", ASK_COPY.refused],
    [{ outcome: "failed", status: 500 }, "failed", ASK_COPY.failed],
  ] as [TextSendResult, string, string][])("a send that comes back %j is shown plainly and kept as %s", async (send, status, problem) => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, w, stops, events } = world({ send });
    expect(await askLead(store, press)).toEqual({ ok: false, problem });
    expect(w.rows[0]?.status).toBe(status);
    // The sender says they opted out: the agreement ends here too.
    expect(stops).toEqual(send.outcome === "opted_out" ? [PHONE] : []);
    expect(events[0]?.dims).toEqual({ mode: "real", outcome: send.outcome });
    expect(JSON.stringify(logged.mock.calls)).not.toContain(PHONE.slice(1));
  });

  it("a recording fault never changes what happened to the text", async () => {
    const { store } = world();
    store.record = async () => {
      throw new Error("down");
    };
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
  });
});

describe("a press in a demo workspace", () => {
  it("goes to the demo number, whoever the lead is, and never to the lead's own number", async () => {
    const { store, sends, w, events } = world({ demo: true, demoNumber: OTHER_PHONE });
    expect(await askPreview(store, press)).toMatchObject({ ok: true, mode: "demo", warning: null });
    expect(await askLead(store, press)).toEqual({ ok: true, practice: false });
    expect(sends.map((sent) => sent.to)).toEqual([OTHER_PHONE]);
    expect(w.rows[0]).toMatchObject({ contact_id: null, to_demo: true });
    expect(events[0]?.dims).toEqual({ mode: "demo", outcome: "accepted" });
  });

  it("says so when no demo number is set, and sends nothing", async () => {
    const { store, sends } = world({ demo: true, demoNumber: null });
    expect(await askPreview(store, press)).toMatchObject({ ok: true, warning: ASK_COPY.noDemoNumberYet });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.noDemoNumber });
    expect(sends).toHaveLength(0);
  });

  it("does not end an agreement when the demo number has opted out", async () => {
    const { store, stops } = world({ demo: true, demoNumber: OTHER_PHONE, send: { outcome: "opted_out" } });
    expect(await askLead(store, press)).toEqual({ ok: false, problem: ASK_COPY.optedOut });
    expect(stops).toEqual([]);
  });
});

describe("the practice path, before the carriers approve the number", () => {
  const practice = () => world({ demo: true, config: null, demoNumber: OTHER_PHONE });

  it("makes a practice ask in a demo workspace while texting is off, and sends nothing", async () => {
    const { store, sends, w, events } = practice();
    expect(await askPreview(store, press)).toMatchObject({ ok: true, mode: "practice", warning: null });
    expect(await askLead(store, press)).toEqual({ ok: true, practice: true });
    expect(sends).toHaveLength(0);
    expect(w.rows[0]).toMatchObject({ status: "practice", to_demo: true, contact_id: null });
    expect(events).toEqual([{ event: "lead_ask.result", dims: { mode: "practice", outcome: "accepted" }, who: expect.anything() }]);
    expect(await askLead(store, press)).toEqual({ ok: true, practice: true });
    expect(w.rows).toHaveLength(1);
  });

  it.each(["yes", "no", "stop"] as const)("an admin answers %s as the lead would, through the same recogniser and the same write", async (reply) => {
    const { store, w, events, stops } = practice();
    await askLead(store, press);
    expect(await practiceReply(store, { proposal_id: PROPOSAL, profile_id: null, reply })).toEqual({ ok: true });
    expect(w.rows[0]?.reply).toBe(reply);
    expect(events.at(-1)).toMatchObject({ event: "lead_ask.replied", dims: { mode: "practice", reply } });
    // A practice STOP never ends anyone's agreement.
    expect(stops).toEqual([]);
    expect(await practiceReply(store, { proposal_id: PROPOSAL, profile_id: null, reply })).toEqual({ ok: false, problem: ASK_COPY.practiceGone });
  });

  it("does not exist in a real workspace, for a member, on a real ask, or on another workspace's proposal", async () => {
    const real = world();
    await askLead(real.store, press);
    expect(await practiceReply(real.store, { proposal_id: PROPOSAL, profile_id: null, reply: "yes" })).toEqual({ ok: false, problem: ASK_COPY.practiceOnly });
    expect(real.w.rows[0]?.reply).toBeNull();

    const member = practice();
    await askLead(member.store, press);
    member.w.role = "manager";
    const asMember = world({ ...member.w, role: "manager" });
    expect(await practiceReply(asMember.store, { proposal_id: PROPOSAL, profile_id: null, reply: "yes" })).toEqual({ ok: false, problem: ASK_COPY.practiceOnly });

    // A demo workspace with texting on: the ask on the row is a real one, and a practice answer cannot touch it.
    const live = world({ demo: true, demoNumber: OTHER_PHONE });
    await askLead(live.store, press);
    expect(await practiceReply(live.store, { proposal_id: PROPOSAL, profile_id: null, reply: "yes" })).toEqual({ ok: false, problem: ASK_COPY.practiceOnly });
    expect(live.w.rows[0]?.reply).toBeNull();

    // A practice ask made before texting was switched on cannot be answered once it is on.
    const before = practice();
    await askLead(before.store, press);
    expect(before.w.rows[0]?.status).toBe("practice");
    const after = world({ ...before.w, config: world({ demo: true, demoNumber: OTHER_PHONE }).w.config });
    expect(await practiceReply(after.store, { proposal_id: PROPOSAL, profile_id: null, reply: "yes" })).toEqual({ ok: false, problem: ASK_COPY.practiceOnly });
    expect(after.w.rows[0]?.reply).toBeNull();
    // And it does not hold up the real ask.
    expect(await askLead(after.store, { ...press, press_id: "99999999-9999-4999-8999-999999999999" })).toEqual({ ok: true, practice: false });

    const elsewhere = world({ demo: true, config: null, proposal: { id: PROPOSAL, org_id: ORG_B, status: "open", lead_contact_id: LEAD } });
    expect(await practiceReply(elsewhere.store, { proposal_id: PROPOSAL, profile_id: null, reply: "yes" })).toEqual({ ok: false, problem: ASK_COPY.practiceOnly });
  });
});

/* ---------------------------------------------------------------------------
 * What the sender posts back, run against the real queries on a small in-memory database
 * ------------------------------------------------------------------------- */

type Row = Record<string, unknown>;

function fakeDb(tables: Record<string, Row[]>, fail: { table?: string } = {}) {
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    let mode: "select" | "update" | "delete" = "select";
    let patch: Row = {};
    let single = false;
    let limit = Infinity;
    let order: { column: string; ascending: boolean } | null = null;
    const tests: ((row: Row) => boolean)[] = [];
    const run = () => {
      if (fail.table === name) return { data: null, error: { code: "XX000" }, count: null };
      const hit = rows.filter((row) => tests.every((test) => test(row)));
      if (mode === "update") for (const row of hit) Object.assign(row, patch);
      if (mode === "delete") for (const row of hit) rows.splice(rows.indexOf(row), 1);
      const sorted = order ? [...hit].sort((a, b) => String(a[order!.column]).localeCompare(String(b[order!.column])) * (order!.ascending ? 1 : -1)) : hit;
      const data = sorted.slice(0, limit).map((row) => ({ ...row }));
      return { data: single ? (data[0] ?? null) : data, error: null, count: hit.length };
    };
    const query = {
      select: () => query,
      update: (next: Row) => ((mode = "update"), (patch = next), query),
      delete: () => ((mode = "delete"), query),
      insert: async (row: Row) => {
        if (fail.table === name) return { error: { code: "XX000" } };
        if (rows.some((existing) => existing["id"] === row["id"])) return { error: { code: "23505" } };
        rows.push({ ...row });
        return { error: null };
      },
      eq: (column: string, value: unknown) => (tests.push((row) => row[column] === value), query),
      neq: (column: string, value: unknown) => (tests.push((row) => row[column] !== value), query),
      is: (column: string, value: null) => (tests.push((row) => (row[column] ?? null) === value), query),
      gte: (column: string, value: string) => (tests.push((row) => String(row[column]) >= value), query),
      in: (column: string, values: unknown[]) => (tests.push((row) => values.includes(row[column])), query),
      or: (expression: string) => {
        const parts = expression.split(",").map((part) => part.split(/\.(is|lt)\./));
        tests.push((row) => parts.some(([column, op, value]) => (op === "is" ? (row[column!] ?? null) === null : row[column!] != null && String(row[column!]) < String(value))));
        return query;
      },
      order: (column: string, options: { ascending: boolean }) => ((order = { column, ascending: options.ascending }), query),
      limit: (count: number) => ((limit = count), query),
      maybeSingle: async () => ((single = true), run()),
      then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return query;
  };
  return { from, rpc: async () => ({ data: null, error: null }) };
}

const CONTACT_A = "0000000a-0000-4000-8000-00000000000a";
const CONTACT_B = "0000000b-0000-4000-8000-00000000000b";
const CONTACT_B2 = "0000000b-0000-4000-8000-0000000000b2";

function inbound(over: { asks?: Row[]; consents?: Row[]; demos?: Row[]; fail?: string } = {}) {
  const tables: Record<string, Row[]> = {
    message_consents: over.consents ?? [
      { id: "c-a", org_id: ORG_A, roster_contact_id: CONTACT_A, phone_e164: PHONE, revoked_at: null, confirmed_at: null },
      { id: "c-b", org_id: ORG_B, roster_contact_id: CONTACT_B, phone_e164: PHONE, revoked_at: null, confirmed_at: null },
      { id: "c-b2", org_id: ORG_B, roster_contact_id: CONTACT_B2, phone_e164: OTHER_PHONE, revoked_at: null, confirmed_at: null },
    ],
    demo_text_recipients: over.demos ?? [],
    proposal_texts: over.asks ?? [],
  };
  const db = fakeDb(tables, over.fail ? { table: over.fail } : {});
  const events: { orgId: string; event: string; dims: Record<string, string> }[] = [];
  const store = inboundStoreOn(db as never, {
    numbers: consentRecords(db as never),
    ourNumber: () => OURS,
    record: async (who, event, dims) => {
      events.push({ orgId: who.orgId, event, dims });
    },
    now: () => NOW,
  });
  return { tables, store, events, ask: (id: string) => tables["proposal_texts"]!.find((row) => row["id"] === id)! };
}

const askRow = (over: Row): Row => ({ id: "t-a", org_id: ORG_A, proposal_id: "prop-a", kind: "lead_ask", contact_id: CONTACT_A, to_demo: false, press_id: "x", status: "accepted", status_at: null, provider_id: null, reply: null, replied_at: null, created_at: hoursAgo(2), ...over });
const received = (from: string, text: string, to = OURS) => ({ type: "sms.received", timestamp: NOW.toISOString(), data: { from, to, text } });

describe("a reply", () => {
  it("YES lands on the one waiting ask, with nothing else kept", async () => {
    const { store, ask, events, tables } = inbound({ asks: [askRow({})] });
    expect(await handleTextEvent(store, received(PHONE, " Yes. "))).toBe("done");
    expect(ask("t-a")).toMatchObject({ reply: "yes", replied_at: NOW.toISOString() });
    expect(events).toEqual([{ orgId: ORG_A, event: "lead_ask.replied", dims: { mode: "real", reply: "yes" } }]);
    // A real message from the number proves the person holds it.
    expect(tables["message_consents"]!.filter((row) => row["confirmed_at"]).map((row) => row["id"])).toEqual(["c-a", "c-b"]);
    expect(JSON.stringify([tables["proposal_texts"], events])).not.toContain(PHONE.slice(1));
  });

  it("reads the words whichever field the sender puts them in", async () => {
    for (const data of [{ text: "YES" }, { body: "YES" }, { text: { body: "YES" } }]) {
      const { store, ask } = inbound({ asks: [askRow({})] });
      await handleTextEvent(store, { type: "sms.received", timestamp: NOW.toISOString(), data: { from: PHONE, to: OURS, ...data } });
      expect(ask("t-a")["reply"]).toBe("yes");
    }
  });

  it("a reply for firm A never touches firm B, even when the same number has agreed in both", async () => {
    const { store, ask, events } = inbound({ asks: [askRow({}), askRow({ id: "t-b-old", org_id: ORG_B, contact_id: CONTACT_B, reply: "no", replied_at: hoursAgo(30), created_at: hoursAgo(40) }), askRow({ id: "t-b-other", org_id: ORG_B, contact_id: CONTACT_B2 })] });
    await handleTextEvent(store, received(PHONE, "YES"));
    expect(ask("t-a")["reply"]).toBe("yes");
    // Firm B's answered ask to the same person, and its waiting ask to someone else, are untouched.
    expect(ask("t-b-old")).toMatchObject({ reply: "no", replied_at: hoursAgo(30) });
    expect(ask("t-b-other")["reply"]).toBeNull();
    expect(events.map((event) => event.orgId)).toEqual([ORG_A]);
  });

  it("a reply from firm B's other person lands only on firm B's ask", async () => {
    const { store, ask } = inbound({ asks: [askRow({}), askRow({ id: "t-b-other", org_id: ORG_B, contact_id: CONTACT_B2 })] });
    await handleTextEvent(store, received(OTHER_PHONE, "no"));
    expect(ask("t-b-other")["reply"]).toBe("no");
    expect(ask("t-a")["reply"]).toBeNull();
  });

  it("with an ask waiting in two workspaces at once, the reply is not guessed at: it lands on neither", async () => {
    const { store, ask, events } = inbound({ asks: [askRow({}), askRow({ id: "t-b", org_id: ORG_B, contact_id: CONTACT_B })] });
    expect(await handleTextEvent(store, received(PHONE, "YES"))).toBe("done");
    expect([ask("t-a")["reply"], ask("t-b")["reply"]]).toEqual([null, null]);
    expect(events).toEqual([]);
  });

  it("an ask to the same roster id in another workspace is never matched by a number that agreed only here", async () => {
    // The number agreed in A only. B has an ask to a person with the same roster id (it cannot happen, and still must not match).
    const { store, ask } = inbound({ consents: [{ id: "c-a", org_id: ORG_A, roster_contact_id: CONTACT_A, phone_e164: PHONE, revoked_at: null, confirmed_at: null }], asks: [askRow({ id: "t-b", org_id: ORG_B, contact_id: CONTACT_A })] });
    await handleTextEvent(store, received(PHONE, "YES"));
    expect(ask("t-b")["reply"]).toBeNull();
  });

  it("nothing is stored for words we do not act on, an unknown number, an ended agreement, an old ask or a second reply", async () => {
    const words = inbound({ asks: [askRow({})] });
    await handleTextEvent(words.store, received(PHONE, "yes, call me on 206 555 0199 about the fee"));
    expect(words.ask("t-a")).toMatchObject({ reply: null, replied_at: null });
    expect(JSON.stringify(words.tables)).not.toContain("call me");

    const stranger = inbound({ asks: [askRow({})] });
    await handleTextEvent(stranger.store, received("+12065550999", "YES"));
    expect(stranger.ask("t-a")["reply"]).toBeNull();

    const ended = inbound({ consents: [{ id: "c-a", org_id: ORG_A, roster_contact_id: CONTACT_A, phone_e164: PHONE, revoked_at: hoursAgo(1), confirmed_at: null }], asks: [askRow({})] });
    await handleTextEvent(ended.store, received(PHONE, "YES"));
    expect(ended.ask("t-a")["reply"]).toBeNull();

    const old = inbound({ asks: [askRow({ created_at: hoursAgo(ASK_WAIT_HOURS + 1) })] });
    await handleTextEvent(old.store, received(PHONE, "YES"));
    expect(old.ask("t-a")["reply"]).toBeNull();

    const twice = inbound({ asks: [askRow({})] });
    await handleTextEvent(twice.store, received(PHONE, "YES"));
    await handleTextEvent(twice.store, received(PHONE, "NO"));
    expect(twice.ask("t-a")["reply"]).toBe("yes");
    expect(twice.events).toHaveLength(1);
  });

  it("ignores a message that was not sent to our number, or not from a full phone number", async () => {
    const { store, ask, tables } = inbound({ asks: [askRow({})] });
    await handleTextEvent(store, received(PHONE, "YES", "+14255550999"));
    await handleTextEvent(store, received("Christy", "YES"));
    await handleTextEvent(store, { type: "sms.received", timestamp: null, data: {} });
    expect(ask("t-a")["reply"]).toBeNull();
    expect(tables["message_consents"]!.every((row) => row["confirmed_at"] === null)).toBe(true);
  });

  it("a practice ask is never answered by a real text", async () => {
    const { store, ask } = inbound({ demos: [{ org_id: ORG_A, phone_e164: PHONE }], consents: [], asks: [askRow({ contact_id: null, to_demo: true, status: "practice" })] });
    await handleTextEvent(store, received(PHONE, "YES"));
    expect(ask("t-a")["reply"]).toBeNull();
  });

  it("a demo workspace's demo number answers that workspace's ask", async () => {
    const { store, ask, events } = inbound({ consents: [], demos: [{ org_id: ORG_A, phone_e164: PHONE }], asks: [askRow({ contact_id: null, to_demo: true }), askRow({ id: "t-b", org_id: ORG_B, contact_id: null, to_demo: true })] });
    await handleTextEvent(store, received(PHONE, "yes"));
    expect(ask("t-a")["reply"]).toBe("yes");
    expect(ask("t-b")["reply"]).toBeNull();
    expect(events[0]?.dims).toEqual({ mode: "demo", reply: "yes" });
  });

  it("asks for a retry when the asks cannot be read", async () => {
    const { store } = inbound({ asks: [askRow({})], fail: "proposal_texts" });
    expect(await handleTextEvent(store, received(PHONE, "YES"))).toBe("retry");
  });
});

describe("STOP", () => {
  it.each(["STOP", "stop.", " Unsubscribe "])("%j ends every agreement for the number at once, in every workspace, and closes the waiting asks", async (word) => {
    const { store, tables, ask, events } = inbound({ demos: [{ org_id: ORG_A, phone_e164: PHONE }, { org_id: ORG_B, phone_e164: OTHER_PHONE }], asks: [askRow({}), askRow({ id: "t-b", org_id: ORG_B, contact_id: CONTACT_B }), askRow({ id: "t-b-other", org_id: ORG_B, contact_id: CONTACT_B2 })] });
    expect(await handleTextEvent(store, received(PHONE, word))).toBe("done");
    const consents = tables["message_consents"]!;
    expect(consents.filter((row) => row["phone_e164"] === PHONE).every((row) => row["revoked_at"] && row["revoked_reason"] === "stop_reply")).toBe(true);
    // Someone else's agreement, and someone else's demo number, are left alone.
    expect(consents.find((row) => row["id"] === "c-b2")?.["revoked_at"]).toBeNull();
    expect(tables["demo_text_recipients"]).toEqual([{ org_id: ORG_B, phone_e164: OTHER_PHONE }]);
    expect([ask("t-a")["reply"], ask("t-b")["reply"], ask("t-b-other")["reply"]]).toEqual(["stop", "stop", null]);
    expect(events.map((event) => event.dims["reply"])).toEqual(["stop", "stop"]);
  });

  it("after STOP the number has no agreement to send on", async () => {
    const { store, tables } = inbound({ asks: [askRow({})] });
    await handleTextEvent(store, received(PHONE, "STOP"));
    const records = consentRecords(fakeDb(tables) as never);
    expect(await records.numberFor(ORG_A, CONTACT_A)).toBeNull();
    expect(await records.numberFor(ORG_B, CONTACT_B)).toBeNull();
    expect(await records.numberFor(ORG_B, CONTACT_B2)).toBe(OTHER_PHONE);
  });

  it("the sender's own opt-out notice does the same, and only for our number", async () => {
    const ours = inbound({ asks: [askRow({})] });
    expect(await handleTextEvent(ours.store, { type: "sms_suppression.created", timestamp: NOW.toISOString(), data: { destination: PHONE, originator: OURS, reason: "opt_out" } })).toBe("done");
    expect(ours.tables["message_consents"]!.filter((row) => row["revoked_at"]).map((row) => row["id"])).toEqual(["c-a", "c-b"]);
    const other = inbound({ asks: [askRow({})] });
    await handleTextEvent(other.store, { type: "sms_suppression.created", timestamp: NOW.toISOString(), data: { destination: PHONE, originator: "+14255550999" } });
    expect(other.tables["message_consents"]!.every((row) => row["revoked_at"] === null)).toBe(true);
  });

  it("asks for a retry when the agreements could not be ended, so a STOP is never lost", async () => {
    const { store } = inbound({ asks: [askRow({})], fail: "message_consents" });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await handleTextEvent(store, received(PHONE, "STOP"))).toBe("retry");
  });
});

describe("delivery reports", () => {
  const report = (type: string, at: string, data: Row = {}) => ({ type, timestamp: at, data: { sms_id: "sms_0123456789", to: PHONE, from: OURS, ...data } });

  it("mark the text delivered or not arrived, by the sender's id", async () => {
    const { store, ask } = inbound({ asks: [askRow({ provider_id: "sms_0123456789" }), askRow({ id: "t-b", org_id: ORG_B, contact_id: CONTACT_B, provider_id: "sms_another0001" })] });
    await handleTextEvent(store, report("sms.delivered", hoursAgo(1)));
    expect(ask("t-a")).toMatchObject({ status: "delivered", status_at: hoursAgo(1) });
    expect(ask("t-b")["status"]).toBe("accepted");
  });

  it("arrive in any order: a later report already on the row wins", async () => {
    const { store, ask } = inbound({ asks: [askRow({ provider_id: "sms_0123456789" })] });
    await handleTextEvent(store, report("sms.delivered", hoursAgo(1)));
    await handleTextEvent(store, report("sms.sent", hoursAgo(2)));
    expect(ask("t-a")["status"]).toBe("delivered");
    await handleTextEvent(store, report("sms.delivered", hoursAgo(1)));
    expect(ask("t-a")["status"]).toBe("delivered");
  });

  it("find the text by our own id when the send's answer never reached us", async () => {
    const id = "00000009-0000-4000-8000-000000000009";
    const { store, ask } = inbound({ asks: [askRow({ id, status: "queued" })] });
    await handleTextEvent(store, report("sms.undelivered", hoursAgo(1), { metadata: { text_id: id } }));
    expect(ask(id)).toMatchObject({ status: "undelivered", provider_id: "sms_0123456789" });
  });

  it("never touch a practice ask, and ignore an id that is not an id or a type we do not know", async () => {
    const id = "00000009-0000-4000-8000-000000000009";
    const { store, ask } = inbound({ asks: [askRow({ id, status: "practice", contact_id: null, to_demo: true })] });
    await handleTextEvent(store, report("sms.delivered", hoursAgo(1), { metadata: { text_id: id } }));
    expect(await handleTextEvent(store, report("sms.delivered", hoursAgo(1), { sms_id: "x'; drop" }))).toBe("done");
    expect(await handleTextEvent(store, report("sms.clicked", hoursAgo(1)))).toBe("done");
    expect(await handleTextEvent(store, { type: "email.bounced", timestamp: null, data: {} })).toBe("done");
    expect(ask(id)["status"]).toBe("practice");
  });

  it("a report dated in the future counts as now", async () => {
    const { store, ask } = inbound({ asks: [askRow({ provider_id: "sms_0123456789" })] });
    await handleTextEvent(store, report("sms.sent", "2030-01-01T00:00:00Z"));
    expect(ask("t-a")["status_at"]).toBe(NOW.toISOString());
  });
});

/* ---------------------------------------------------------------------------
 * The public address
 * ------------------------------------------------------------------------- */

const SECRET = `whsec_${Buffer.from("a-test-signing-secret-of-32-bytes").toString("base64")}`;

function signed(body: string, over: { id?: string; at?: Date; secret?: string } = {}) {
  const id = over.id ?? "msg_1";
  const at = over.at ?? new Date();
  const signature = new Webhook(over.secret ?? SECRET).sign(id, at, body);
  return new Request("https://lasso.example/api/public/text-events", { method: "POST", body, headers: { "webhook-id": id, "webhook-timestamp": String(Math.floor(at.getTime() / 1000)), "webhook-signature": signature, "content-type": "application/json", "x-forwarded-for": "203.0.113.9" } });
}

function address(over: Partial<TextEventDeps> & { asks?: Row[] } = {}) {
  const world = inbound({ asks: over.asks ?? [askRow({})] });
  const seen = new Set<string>();
  const released: string[] = [];
  const deps: TextEventDeps = {
    secret: () => SECRET,
    limiter: memoryLimiter(),
    claim: async (id) => (seen.has(id) ? "seen" : (seen.add(id), "new")),
    release: async (id) => {
      seen.delete(id);
      released.push(id);
    },
    store: async () => world.store,
    now: () => Date.now(),
    ...over,
  };
  return { ...world, deps, released };
}

describe("the public address", () => {
  const body = JSON.stringify({ type: "sms.received", timestamp: new Date().toISOString(), data: { from: PHONE, to: OURS, text: "YES" } });

  it("acts on a correctly signed event", async () => {
    const { deps, ask } = address();
    const response = await handleTextEventRequest(signed(body), deps);
    expect(response.status).toBe(200);
    expect(ask("t-a")["reply"]).toBe("yes");
  });

  it("refuses a wrong signature, a body changed after signing, a missing header and an old timestamp, and acts on none", async () => {
    const { deps, ask } = address();
    const wrongKey = signed(body, { secret: `whsec_${Buffer.from("another-secret-of-thirty-two-byte").toString("base64")}` });
    const good = signed(body);
    const tampered = new Request(good.url, { method: "POST", body: body.replace("YES", "NO "), headers: good.headers });
    const bare = new Request(good.url, { method: "POST", body });
    const old = signed(body, { at: new Date(Date.now() - 6 * 60_000) });
    const future = signed(body, { at: new Date(Date.now() + 6 * 60_000) });
    for (const request of [wrongKey, tampered, bare, old, future]) expect((await handleTextEventRequest(request, deps)).status).toBe(401);
    expect(ask("t-a")["reply"]).toBeNull();
  });

  it("acts once on an event delivered twice, and on a replay of a captured request", async () => {
    const { deps, events } = address();
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(200);
    const again = await handleTextEventRequest(signed(body), deps);
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ ok: true, seen: true });
    expect(events).toHaveLength(1);
  });

  it("is closed until its secret is set, and reads nothing", async () => {
    const store = vi.fn();
    const { deps } = address({ secret: () => null, store: store as never });
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(503);
    expect(store).not.toHaveBeenCalled();
  });

  it("turns away an oversized request and a caller who keeps sending unsigned ones", async () => {
    const { deps, ask } = address();
    const huge = "x".repeat(70_000);
    expect((await handleTextEventRequest(signed(huge), deps)).status).toBe(413);
    let last = 0;
    for (let i = 0; i < 25; i += 1) last = (await handleTextEventRequest(new Request("https://lasso.example/api/public/text-events", { method: "POST", body, headers: { "x-forwarded-for": "198.51.100.7" } }), deps)).status;
    expect(last).toBe(429);
    // Another caller, correctly signed, is still served.
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(200);
    expect(ask("t-a")["reply"]).toBe("yes");
  });

  it("asks for a retry and lets go of the id when the event could not be handled, then takes the retry", async () => {
    let broken = true;
    const base = address();
    const deps: TextEventDeps = { ...base.deps, store: async () => (broken ? Promise.reject(new Error("down")) : base.store) };
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(503);
    expect(base.released).toEqual(["msg_1"]);
    broken = false;
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(200);
    expect(base.ask("t-a")["reply"]).toBe("yes");
    // The log line names the kind of event and nothing from it.
    expect(JSON.stringify(logged.mock.calls)).not.toMatch(/2065550142|YES/);
  });

  it("answers 503 when the id cannot be kept, and acknowledges a test event or a shape it does not know without acting", async () => {
    const { deps, ask } = address({ claim: async () => "failed" });
    expect((await handleTextEventRequest(signed(body), deps)).status).toBe(503);
    const calm = address();
    for (const odd of [JSON.stringify({ type: "sms.received", test: true, data: { from: PHONE, to: OURS, text: "YES" } }), JSON.stringify({ hello: "there" }), JSON.stringify([1, 2]), JSON.stringify({ type: "sms.received", data: "YES" })]) {
      expect((await handleTextEventRequest(signed(odd, { id: `odd_${odd.length}` }), calm.deps)).status).toBe(200);
    }
    expect([ask("t-a")["reply"], calm.ask("t-a")["reply"]]).toEqual([null, null]);
  });

  it("the route is public, takes POST only, and hands everything to the checked handler", () => {
    const route = readFileSync("src/routes/api/public/text-events.ts", "utf8");
    expect(route).toContain('createFileRoute("/api/public/text-events")');
    expect(route).toMatch(/handlers: \{\s+POST:/);
    expect(route).not.toMatch(/GET:|PUT:|console\./);
    const server = readFileSync("src/lib/text-events.server.ts", "utf8");
    // The signature is checked before the id is kept or the store is opened.
    expect(server.indexOf(".verify(body")).toBeLessThan(server.indexOf("deps.claim(id)"));
    expect(server.indexOf("deps.claim(id)")).toBeLessThan(server.indexOf("deps.store()"));
    expect(server).not.toMatch(/console\.(log|info|warn)/);
  });
});

describe("the one sender function", () => {
  it("labels the ask, carries our id for the delivery reports, and returns the sender's id", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "sms_0123456789", status: "accepted" }), { status: 202 }));
    expect(await sendText(CONFIG, { to: PHONE, text: "hello", idempotencyKey: "lead-ask/r1", kind: "lead_ask", ref: "r1" }, fetchImpl as never)).toEqual({ outcome: "accepted", id: "sms_0123456789" });
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.headers).toMatchObject({ "Idempotency-Key": "lead-ask/r1" });
    expect(JSON.parse(String(init.body))).toMatchObject({ to: PHONE, tags: [{ name: "kind", value: "lead_ask" }], metadata: { text_id: "r1" } });
  });

  it("an accepted send with no readable id is still accepted, and an id that could be a number is not kept", async () => {
    expect(await sendText(CONFIG, { to: PHONE, text: "hello", idempotencyKey: "k" }, (async () => new Response("", { status: 202 })) as never)).toEqual({ outcome: "accepted" });
    expect(await sendText(CONFIG, { to: PHONE, text: "hello", idempotencyKey: "k" }, (async () => new Response(JSON.stringify({ id: PHONE }), { status: 202 })) as never)).toEqual({ outcome: "accepted" });
  });
});

describe("what is recorded", () => {
  it("the two events carry mode and outcome or reply, and nothing else gets through", () => {
    expect(EVENT_DIM_KEYS["lead_ask.result"]).toEqual(["mode", "outcome"]);
    expect(EVENT_DIM_KEYS["lead_ask.replied"]).toEqual(["mode", "reply"]);
    expect(guardServerEventDims("lead_ask.replied", { mode: "real", reply: "yes", phone: PHONE, name: "Christy", seconds: 40 } as never).dims).toEqual({ mode: "real", reply: "yes" });
  });
});

describe("wiring", () => {
  const server = readFileSync("src/lib/lead-ask.server.ts", "utf8");
  const functions = readFileSync("src/lib/lead-ask.functions.ts", "utf8");

  it("every server function is signed in first, and the real store starts with the firm member check", () => {
    expect(functions.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(3);
    expect(functions.match(/createServerFn\(/g)).toHaveLength(3);
    const real = server.slice(server.indexOf("export async function realAskStore"));
    expect(real.indexOf("requireFirmMember(")).toBeGreaterThan(-1);
    expect(real.indexOf("requireFirmMember(")).toBeLessThan(real.indexOf('.from("'));
  });

  it("every read and write of a signed-in person's asks names the workspace", () => {
    const real = server.slice(server.indexOf("export async function realAskStore"), server.indexOf("type NumberRecords"));
    const queries = real.split('.from("proposal_texts")').slice(1);
    expect(queries.length).toBeGreaterThanOrEqual(5);
    for (const query of queries) expect(query.split(";")[0]).toMatch(/\.eq\("org_id", orgId\)|insert\(\{ \.\.\.row/);
    expect(server).toMatch(/\.update\(\{ reply, replied_at: at\.toISOString\(\) \}\)\.eq\("id", id\)\.eq\("org_id", orgId\)\.is\("reply", null\)/);
  });

  it("the number is never logged, returned or stored, and there is no flag", () => {
    expect(server).not.toMatch(/console\.(log|info|warn)/);
    for (const line of server.split("\n").filter((text) => text.includes("console.error"))) expect(line).not.toMatch(/\bto\b|phone|number|words|text\}/);
    expect(server + functions).not.toMatch(/isFeatureEnabled|posthog|featureFlag/i);
    expect(server).not.toMatch(/phone_e164: |to: to,/);
  });
});

describe("the migration", () => {
  const sql = readFileSync("supabase/migrations/20261120030000_lead_asks.sql", "utf8");
  const bare = sql.replace(/--.*$/gm, "");

  it("can run twice: every statement is guarded or repeatable", () => {
    const statements = bare.replace(/\$\$[\s\S]*?\$\$/g, "$$body$$").split(";").map((part) => part.trim().replace(/\s+/g, " ")).filter(Boolean);
    const repeatable = /^(create table if not exists|create (unique )?index if not exists|create or replace function|drop trigger if exists \S+ on public\.(proposal_texts|orgs)$|create trigger (proposal_texts_t_guard|orgs_guard_settings) |alter table public\.(proposal_texts|text_webhook_events) enable row level security$|revoke all on public\.(proposal_texts|text_webhook_events) from anon, authenticated$|grant all on public\.(proposal_texts|text_webhook_events) to service_role$|alter table public\.proposals add column if not exists )/;
    for (const statement of statements) expect(statement).toMatch(repeatable);
    // Each trigger is dropped only to be made again straight after.
    expect(bare.match(/drop trigger if exists/g)).toHaveLength(2);
    expect(bare.match(/create trigger/g)).toHaveLength(2);
  });

  it("only adds: no table, column, row, index or policy is removed or changed", () => {
    expect(bare).not.toMatch(/\b(truncate|delete from|drop table|drop column|drop policy|drop index|alter column|rename|update public\.)\b/i);
    expect(bare).not.toMatch(/create policy|\bto (anon|authenticated)\b/i);
    expect(sql).not.toMatch(/[—–]/);
  });

  it("keeps no phone number and no words, only one of three replies", () => {
    expect(bare).not.toMatch(/phone|e164|body text|message text/i);
    expect(bare).toMatch(/reply text check \(reply is null or reply = any \(array\['yes', 'no', 'stop'\]::text\[\]\)\)/);
  });

  it("is server only, keeps a text in one workspace, and holds one row per press", () => {
    expect(bare).toMatch(/alter table public\.proposal_texts enable row level security/);
    expect(bare).toMatch(/revoke all on public\.proposal_texts from anon, authenticated/);
    expect(bare).toMatch(/create unique index if not exists proposal_texts_press_key on public\.proposal_texts \(proposal_id, kind, press_id\)/);
    const guard = bare.slice(bare.indexOf("function public.proposal_texts_guard"), bare.indexOf("drop trigger if exists proposal_texts_t_guard"));
    expect(guard).toMatch(/from proposals p where p\.id = new\.proposal_id and p\.org_id = new\.org_id/);
    expect(guard).toMatch(/from roster_contacts r where r\.id = new\.contact_id and r\.org_id = new\.org_id/);
    expect(guard).toMatch(/new\.org_id <> old\.org_id or new\.proposal_id <> old\.proposal_id/);
  });

  it("refuses a browser's write of the demo marker, a non-object settings value, and a lost or changed company type", () => {
    const guard = bare.slice(bare.indexOf("function public.orgs_guard_settings"));
    expect(guard).toMatch(/if auth\.uid\(\) is null then return new; end if;/);
    expect(guard).toMatch(/jsonb_typeof\(new\.settings\) <> 'object'/);
    expect(guard).toMatch(/\(new\.settings -> 'demo_firm'\) is distinct from \(was -> 'demo_firm'\)/);
    expect(guard).toMatch(/not \(new\.settings \? 'type'\) or \(was ->> 'type'\) in \('company', 'partner'\)/);
    expect(guard).toMatch(/create trigger orgs_guard_settings\s+before update on public\.orgs/);
  });
});

describe("20 Nov (Q-67): a preview for a person not saved as the lead yet", () => {
  const OTHER = "00000002-0000-4000-8000-000000000009";
  const STRANGER = "00000002-0000-4000-8000-0000000000ff";
  const two = () =>
    world({
      roster: {
        [`${ORG_A}/${LEAD}`]: "Christy Johnson",
        [`${ORG_A}/${OTHER}`]: "Ben Okoro",
        [`${ORG_B}/${STRANGER}`]: "Someone Else",
      },
      agreed: { [`${ORG_A}/${LEAD}`]: PHONE },
    });

  it("shows that person's own words and whether they agreed, and writes and sends nothing", async () => {
    const { store, sends, w, events } = two();
    const preview = await askPreview(store, {
      proposal_id: PROPOSAL,
      profile_id: null,
      lead_contact_id: OTHER,
    });
    expect(preview).toMatchObject({
      ok: true,
      name: "Ben Okoro",
      mode: "real",
      warning: ASK_COPY.notAgreedYet("Ben Okoro"),
    });
    expect(preview.ok && preview.words).toContain("hi Ben, Maren would love you to lead");
    expect(sends).toHaveLength(0);
    expect(w.rows).toHaveLength(0);
    expect(events).toHaveLength(0);
    expect(w.proposal?.lead_contact_id).toBe(LEAD);
    // With no lead saved at all, a picked person still previews.
    const none = world({
      proposal: { id: PROPOSAL, org_id: ORG_A, status: "open", lead_contact_id: null },
    });
    expect(
      await askPreview(none.store, {
        proposal_id: PROPOSAL,
        profile_id: null,
        lead_contact_id: LEAD,
      }),
    ).toMatchObject({ ok: true, name: "Christy Johnson", warning: null });
    expect(await askPreview(none.store, { proposal_id: PROPOSAL, profile_id: null })).toEqual({
      ok: false,
      problem: ASK_COPY.noLead,
    });
  });

  it("a person on another workspace's list reads as not on the list, and a non-admin still sees nothing", async () => {
    const { store } = two();
    expect(
      await askPreview(store, {
        proposal_id: PROPOSAL,
        profile_id: null,
        lead_contact_id: STRANGER,
      }),
    ).toEqual({ ok: false, problem: ASK_COPY.missing });
    const member = world({ role: "analyst" });
    expect(
      await askPreview(member.store, {
        proposal_id: PROPOSAL,
        profile_id: null,
        lead_contact_id: LEAD,
      }),
    ).toEqual({ ok: false, problem: ASK_COPY.notAllowed });
  });

  it("a press never takes a person from the caller: it asks the saved lead only", async () => {
    const { store, sends } = two();
    const sneaky = { ...press, lead_contact_id: OTHER } as typeof press;
    expect(await askLead(store, sneaky)).toEqual({ ok: true, practice: false });
    expect(sends).toHaveLength(1);
    expect(sends[0]?.text).toContain("hi Christy,");
    expect(askSendInput(sneaky)).not.toHaveProperty("lead_contact_id");
    expect(
      askPreviewInput({ proposal_id: PROPOSAL, lead_contact_id: "not-an-id" }).lead_contact_id,
    ).toBeNull();
    expect(askPreviewInput({ proposal_id: PROPOSAL, lead_contact_id: OTHER }).lead_contact_id).toBe(
      OTHER,
    );
  });
});
