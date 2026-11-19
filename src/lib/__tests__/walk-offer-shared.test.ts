// 18 Nov: Firm Brain Build Spec, step 7. The once-only offer's pure rules: which call titles read like an interview,
// which method's walk-through fits, who is offered it and when it stops.
import { describe, expect, it } from "vitest";

import { METHODS } from "@/lib/engagement-tags";
import {
  interviewOfferMethod,
  WALK_OFFER_COPY,
  walkOfferFor,
  walkOfferState,
  withWalkOffer,
} from "@/lib/walk-offer-shared";

describe("a title that looks like an interview", () => {
  it.each([
    ["Interview: Chief Medical Officer, St. Brigid Health", "stakeholder_interviews"],
    ["CFO interview", "stakeholder_interviews"],
    ["Stakeholder call with the COO", "stakeholder_interviews"],
    ["Stakeholder conversation - operations", "stakeholder_interviews"],
    ["Interviews, round two", "stakeholder_interviews"],
    ["Discovery call: Northwind", "customer_research"],
    ["discovery interview", "customer_research"],
    ["Customer interview 4", "customer_research"],
    ["User interviews (batch B)", "customer_research"],
    ["Patient conversation, home infusion", "customer_research"],
    ["Expert call: former payer executive", "expert_calls"],
    ["Expert interview", "expert_calls"],
    ["Expert network call with a former CFO", "expert_calls"],
  ])("%s offers %s", (title, method) => {
    expect(interviewOfferMethod(title)).toBe(method);
    expect(METHODS).toContain(method);
  });

  it.each([
    "Weekly standup",
    "Stand-up",
    "Deck review",
    "Interview guide review",
    "Review of the interview notes",
    "Steerco readout",
    "Team sync",
    "Interview planning",
    "Project kickoff",
    "1:1 with Harper",
    "Retro",
    "Lunch",
    "Overview of findings",
    "interviewer training",
    "",
    "   ",
  ])("%s offers nothing", (title) => {
    expect(interviewOfferMethod(title)).toBeNull();
  });

  it("reads accented, odd-cased and oddly punctuated titles the same way", () => {
    for (const title of [
      "INTERVIEW \u2014 CMO",
      "iNtErViEw: cmo",
      "Intérview with the directeur",
      "Entrevista: directora de operaciones",
      "Entretien avec le directeur médical",
      "interview_cmo_final(2)",
      "  Interview\tCMO\n",
      "Ｉnterview: CMO",
    ])
      expect(interviewOfferMethod(title), title).toBe("stakeholder_interviews");
    expect(interviewOfferMethod("EXPERT   CALL!!!")).toBe("expert_calls");
    expect(interviewOfferMethod("Dïscövery Cäll")).toBe("customer_research");
    expect(interviewOfferMethod("STÄND-UP")).toBeNull();
    expect(interviewOfferMethod("Révïew of interviews")).toBeNull();
  });

  it("copes with anything else a title can be: missing, hostile or enormous", () => {
    expect(interviewOfferMethod(null)).toBeNull();
    expect(interviewOfferMethod(undefined)).toBeNull();
    expect(interviewOfferMethod(7 as unknown as string)).toBeNull();
    expect(interviewOfferMethod("<script>alert('interview')</script>")).toBe("stakeholder_interviews");
    expect(interviewOfferMethod(`${"x".repeat(100_000)} interview`)).toBeNull();
    expect(interviewOfferMethod("面接 interview 顧客")).toBe("stakeholder_interviews");
  });
});

describe("the saved state", () => {
  it("is opened, dismissed or nothing, and any other value counts as nothing", () => {
    expect(walkOfferState({ walk_offer: "opened" })).toBe("opened");
    expect(walkOfferState({ walk_offer: "dismissed" })).toBe("dismissed");
    for (const meta of [null, undefined, {}, [], "x", { walk_offer: true }, { walk_offer: "seen" }, { walk_offer: null }])
      expect(walkOfferState(meta)).toBeNull();
  });

  it("is set and cleared without touching any other key", () => {
    const meta = { citations: [{ id: "c" }], chat_url: "https://x.test" };
    expect(withWalkOffer(meta, "dismissed")).toEqual({ ...meta, walk_offer: "dismissed" });
    expect(withWalkOffer({ ...meta, walk_offer: "opened" }, null)).toEqual(meta);
    expect(withWalkOffer(null, "opened")).toEqual({ walk_offer: "opened" });
    expect(meta).toEqual({ citations: [{ id: "c" }], chat_url: "https://x.test" });
  });
});

describe("who is offered it", () => {
  const me = { id: "p1", role: "em" };
  const call = { type: "call", title: "Interview: CMO", owner_id: "p1", meta: {} };

  it("offers the matching method to the owner of a call titled like an interview", () => {
    expect(walkOfferFor(call, me)).toBe("stakeholder_interviews");
    for (const role of ["admin", "lead", "em"]) expect(walkOfferFor(call, { id: "p1", role })).toBe("stakeholder_interviews");
  });

  it("uses the name the owner chose when there is one", () => {
    expect(walkOfferFor({ ...call, display_title: "Weekly standup" }, me)).toBeNull();
    expect(walkOfferFor({ ...call, title: "Untitled meeting", display_title: "Expert call: payer" }, me)).toBe("expert_calls");
    expect(walkOfferFor({ ...call, display_title: "   " }, me)).toBe("stakeholder_interviews");
  });

  it("appears once per item: never again after it was opened or dismissed", () => {
    expect(walkOfferFor({ ...call, meta: { walk_offer: "opened" } }, me)).toBeNull();
    expect(walkOfferFor({ ...call, meta: { walk_offer: "dismissed" } }, me)).toBeNull();
  });

  it("never shows to anyone but the owner: a colleague, a coach, a signed-out reader or an item with no owner", () => {
    expect(walkOfferFor(call, { id: "p2", role: "em" })).toBeNull();
    expect(walkOfferFor(call, { id: "p1", role: "coach" })).toBeNull();
    expect(walkOfferFor(call, null)).toBeNull();
    expect(walkOfferFor(call, undefined)).toBeNull();
    expect(walkOfferFor(call, { id: null, role: "em" })).toBeNull();
    expect(walkOfferFor({ ...call, owner_id: null }, me)).toBeNull();
    expect(walkOfferFor({ ...call, owner_id: undefined }, { id: undefined, role: "em" })).toBeNull();
  });

  it("is for calls only", () => {
    for (const type of ["document", "deck", "ai_thread", "sheet", "email"])
      expect(walkOfferFor({ ...call, type }, me)).toBeNull();
  });

  it("says what the spec says, with no em dash", () => {
    expect(WALK_OFFER_COPY.line).toBe("The firm has a walk-through for this. Read it?");
    expect(JSON.stringify(WALK_OFFER_COPY)).not.toContain("\u2014");
  });
});
