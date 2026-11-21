// 20 Nov 2026, chat pill PR 3b (D-111): a pasted brief starts a proposal in the chat. Briefs are told from questions,
// only admins and leads start one, the card's draft becomes New proposal's own input, and a Member's paste reaches the
// admins' notifications and nothing else.
import { describe, expect, it } from "vitest";

import { passBrief, briefAdmins, type BriefPassDeps, type Notice } from "@/lib/brief-pass.server";
import type { BriefReading } from "@/lib/brief-read-shared";
import { notificationSentence, NOTIFICATION_KINDS } from "@/lib/notifications-shared";
import {
  BRIEF_PASS_COPY,
  BRIEF_PASS_DAILY_MAX,
  BRIEF_PASS_EXCERPT,
  briefText,
  draftFrom,
  draftReady,
  dueLabel,
  isBriefPaste,
  mayStartInChat,
  passExcerpt,
  proposalInput,
} from "@/lib/pill-proposal-shared";
import { checkNewProposal } from "@/lib/proposal-desk-shared";

const CLIENTS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Larkspur Senior Living" },
  { id: "22222222-2222-4222-8222-222222222222", name: "Harbor Health" },
];
const PROFILE = "33333333-3333-4333-8333-333333333333";

describe("a brief, not a question", () => {
  it.each([
    "Harbor Health wants a staffing model review, due Friday",
    "Start a proposal: Harbor Health wants a staffing model review",
    "New proposal - Pellham County needs a workforce plan",
    "RFP from Larkspur Senior Living for an operating model redesign",
    "Larkspur asked us for a workforce plan by Dec 3.",
  ])("%s is a brief", (text) => {
    expect(isBriefPaste(text)).toBe(true);
  });

  it.each([
    "What did teams learn on staffing reviews?",
    "Which past engagements are most like Marrowfield?",
    "How did we handle a client who wants a discount",
    "What is due on my boards this week",
    "Does Harbor Health need a proposal?",
    "short",
  ])("%s is a question", (text) => {
    expect(isBriefPaste(text)).toBe(false);
  });

  it("takes a long pasted email of several lines as a brief, and refuses one past the limit", () => {
    const email = [
      "Hi team,",
      "Following our call last week,",
      "we would like to understand our options",
      "for next year across all sites.",
      "Thanks, Dana",
    ]
      .join("\n")
      .padEnd(220, ".");
    expect(isBriefPaste(email)).toBe(true);
    expect(isBriefPaste(`Harbor Health wants ${"x".repeat(8100)}`)).toBe(false);
  });

  it("drops a Start a proposal: in front", () => {
    expect(briefText("  Start a proposal: Harbor Health wants a review ")).toBe(
      "Harbor Health wants a review",
    );
  });

  it("only admins and leads start one in the chat", () => {
    expect(mayStartInChat("admin")).toBe(true);
    expect(mayStartInChat("lead")).toBe(true);
    for (const role of ["member", "em", "analyst", "manager", "coach", null, undefined])
      expect(mayStartInChat(role)).toBe(false);
  });
});

describe("the card's draft as New proposal's input", () => {
  const reading: BriefReading = {
    client: { name: "Harbor Health", id: CLIENTS[1]!.id },
    ask: "a staffing model review",
    due: { phrase: "Friday", date: "2026-11-27" },
    notes: "Harbor Health wants a staffing model review, due Friday.",
    readBy: "model",
  };

  it("fills from the reading and is ready once it has a client and an ask", () => {
    const draft = draftFrom(reading);
    expect(draft).toEqual({
      client: "Harbor Health",
      ask: "a staffing model review",
      dueOn: "2026-11-27",
      workItemIds: [],
    });
    expect(draftReady(draft)).toBe(true);
    expect(draftReady({ ...draft, client: "  " })).toBe(false);
    expect(draftReady({ ...draft, ask: "" })).toBe(false);
  });

  it("names an existing client by id in the firm's spelling, and passes the server's own check", () => {
    const input = proposalInput(
      {
        client: "harbor  health",
        ask: "Staffing model review",
        dueOn: "2026-11-27",
        workItemIds: ["44444444-4444-4444-8444-444444444444"],
      },
      reading.notes,
      CLIENTS,
      PROFILE,
    );
    expect(input).toMatchObject({
      client_id: CLIENTS[1]!.id,
      title: "Staffing model review",
      client_due_on: "2026-11-27",
      notes: reading.notes,
    });
    expect("new_client_name" in input).toBe(false);
    const checked = checkNewProposal(input);
    expect(checked.ok && checked.input.client_due_on).toBe("2026-11-27");
  });

  it("a client we do not have is a new name, and a date that is not real is left off", () => {
    const input = proposalInput(
      { client: "Pellham County", ask: "Workforce plan", dueOn: "2026-02-30", workItemIds: [] },
      "notes",
      CLIENTS,
      PROFILE,
    );
    expect(input).toMatchObject({ new_client_name: "Pellham County" });
    expect("client_due_on" in input).toBe(false);
  });

  it("says a due date as a short day", () => {
    expect(dueLabel("2026-11-27")).toBe("Fri 27 Nov");
    expect(dueLabel("nope")).toBe("");
  });
});

describe("a Member passes a brief to the admins", () => {
  function deps(over: Partial<BriefPassDeps> & { role?: string } = {}) {
    const sent: Notice[][] = [];
    const events: Record<string, string>[] = [];
    const d: BriefPassDeps = {
      caller: async () => ({
        orgId: "o1",
        profileId: "p-member",
        userId: "u1",
        role: over.role ?? "member",
        name: "Elif Yilmaz",
      }),
      admins: async () => [{ id: "p-maren", name: "Maren Hollis" }],
      clients: async () => CLIENTS,
      passedToday: async () => 0,
      notify: async (rows) => {
        sent.push(rows);
        return true;
      },
      record: async (_c, dims) => {
        events.push(dims);
      },
      now: () => new Date("2026-11-20T12:00:00Z"),
      ...over,
    };
    return { d, sent, events };
  }
  const paste =
    "Harbor Health wants a staffing model review, due Friday. Budget is tight, call Dana on 555 0100.";

  it("puts one notice in each admin's Needs you, with who, the client we know and the start of the paste", async () => {
    const { d, sent, events } = deps({
      admins: async () => [
        { id: "a1", name: "Maren Hollis" },
        { id: "a2", name: "Ola Bright" },
      ],
    });
    expect(await passBrief(d, paste)).toEqual({ ok: true, admins: 2 });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.map((row) => row.recipient_profile_id)).toEqual(["a1", "a2"]);
    expect(sent[0]![0]).toMatchObject({
      kind: "brief_passed",
      section: "needs_you",
      org_id: "o1",
      payload: { by: "Elif Yilmaz", client: "Harbor Health" },
    });
    expect(sent[0]![0]!.payload.excerpt).toBe(passExcerpt(paste));
    // The event says how many admins, never the words.
    expect(events).toEqual([{ admins: "2-5" }]);
    expect(JSON.stringify(events)).not.toContain("Harbor");
  });

  it("refuses admins and leads, however the call is made: they start it themselves", async () => {
    for (const role of ["admin", "lead"]) {
      const { d, sent } = deps({ role });
      expect((await passBrief(d, paste)).ok).toBe(false);
      expect(sent).toHaveLength(0);
      expect(await briefAdmins(d)).toEqual({ name: null, count: 0 });
    }
  });

  it("stops at five a day, says so, and sends nothing more", async () => {
    const { d, sent } = deps({ passedToday: async () => BRIEF_PASS_DAILY_MAX });
    expect(await passBrief(d, paste)).toEqual({ ok: false, problem: BRIEF_PASS_COPY.tooMany });
    expect(sent).toHaveLength(0);
  });

  it("says when there is no admin, and when the notice could not be written", async () => {
    expect(await passBrief(deps({ admins: async () => [] }).d, paste)).toEqual({
      ok: false,
      problem: BRIEF_PASS_COPY.noAdmin,
    });
    expect(await passBrief(deps({ notify: async () => false }).d, paste)).toEqual({
      ok: false,
      problem: BRIEF_PASS_COPY.failed,
    });
  });

  it("names the one admin on the button, and nobody when there are several", async () => {
    expect(await briefAdmins(deps().d)).toEqual({ name: "Maren Hollis", count: 1 });
    expect(
      await briefAdmins(
        deps({
          admins: async () => [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
          ],
        }).d,
      ),
    ).toEqual({ name: null, count: 2 });
  });

  it("keeps only the start of a long paste for the bell", () => {
    const long = "word ".repeat(200);
    expect(passExcerpt(long).length).toBeLessThanOrEqual(BRIEF_PASS_EXCERPT);
    expect(passExcerpt(long).endsWith("…")).toBe(true);
  });

  it("the bell says it in plain words", () => {
    expect(NOTIFICATION_KINDS).toContain("brief_passed");
    expect(
      notificationSentence({
        kind: "brief_passed",
        payload: { by: "Elif Yilmaz", client: "Harbor Health" },
      }),
    ).toBe("Elif Yilmaz has a brief for a new proposal for Harbor Health.");
    expect(
      notificationSentence({ kind: "brief_passed", payload: { by: "Elif Yilmaz", client: "" } }),
    ).toBe("Elif Yilmaz has a brief for a new proposal.");
  });
});
