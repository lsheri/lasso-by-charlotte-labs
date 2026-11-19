// 18 Nov: Firm Brain Build Spec, step 5. The extractor writes firm brain tags for real firms. These are the pure rules:
// what one item is asked for, what survives of a model's reply, which item carries the situation, how a board lead's
// correction is checked, and that a re-extract never undoes it.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { METHODS, methodsOf, ROLES, roleOf, SITUATIONS, situationOf, stageOf, TAG_CORRECTION_KEY } from "@/lib/engagement-tags";
import {
  buildTagCorrection,
  canCorrectTags,
  canHoldSituation,
  ITEM_TAGS_COPY,
  itemTagsView,
  MAX_TAG_CHARS,
  mergeExtractedTags,
  nameInRole,
  NO_TAGS,
  parseTagReply,
  sameStoredTags,
  situationCarrierId,
  situationRank,
  tagAskFor,
  tagFieldsFor,
  tagKeysAsked,
  tagPromptLines,
  tagTokenEstimate,
  validateExtractedTags,
  withTagCorrection,
  type CarrierCandidate,
  type TagContext,
} from "@/lib/extract-tags-shared";
import { tagCheckCases } from "@/lib/tag-check-shared";

const ALL_NAMES = [...DEMO_PEOPLE.map((person) => person.name), ...DEMO_BOARDS.map((board) => board.client.name)];

const ctx = (over: Partial<TagContext> = {}): TagContext => ({ type: "document", carrier: false, shown: false, names: [], ...over });
const call = (over: Partial<TagContext> = {}) => ctx({ type: "call", ...over });

describe("what one item is asked for", () => {
  it("asks every item for a method, a call for a role, a deliverable for a stage, and only the carrier for the situation", () => {
    expect(tagKeysAsked(tagAskFor({ type: "ai_thread" }, false))).toEqual(["method"]);
    expect(tagKeysAsked(tagAskFor({ type: "email" }, false))).toEqual(["method"]);
    expect(tagKeysAsked(tagAskFor({ type: "call" }, false))).toEqual(["method", "call_role"]);
    for (const type of ["document", "deck", "sheet"]) expect(tagKeysAsked(tagAskFor({ type }, false))).toEqual(["method", "stage"]);
    expect(tagKeysAsked(tagAskFor({ type: "document" }, true))).toEqual(["method", "stage", "situation"]);
    expect(tagKeysAsked(NO_TAGS)).toEqual([]);
  });

  it("sends the role list only with calls and the situation list only with the carrier, to keep every other call small", () => {
    const document = tagPromptLines(tagAskFor({ type: "document" }, false)).join("\n");
    expect(document).toContain(METHODS.join(", "));
    expect(document).not.toContain("chief_financial_officer");
    expect(document).not.toContain("deal_diligence");
    expect(tagPromptLines(tagAskFor({ type: "call" }, false)).join("\n")).toContain(ROLES.join(", "));
    expect(tagPromptLines(tagAskFor({ type: "document" }, true)).join("\n")).toContain(SITUATIONS.join(", "));
  });

  it("never offers the model the stage only a person can set", () => {
    expect(tagPromptLines(tagAskFor({ type: "deck" }, false)).join("\n")).not.toContain("shown_to_client");
  });

  it("writes its prompt and copy without em dashes", () => {
    const text = [...tagPromptLines({ method: true, callRole: true, stage: true, situation: true }), ...Object.values(ITEM_TAGS_COPY)].join("\n");
    expect(text).not.toMatch(new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`));
  });
});

describe("what survives of the model's reply", () => {
  it("keeps values from the lists, in vocabulary order, without repeats", () => {
    expect(validateExtractedTags({ method: ["synthesis", "stakeholder_interviews", "synthesis"], stage: "draft" }, ctx())).toEqual({
      method: ["stakeholder_interviews", "synthesis"],
      stage: "draft",
    });
    expect(validateExtractedTags({ method: ["expert_calls"], call_role: "chief_financial_officer" }, call())).toEqual({
      method: ["expert_calls"],
      call_role: "chief_financial_officer",
    });
    expect(validateExtractedTags({ method: [], stage: "reviewed", situation: "pricing" }, ctx({ carrier: true }))).toEqual({ stage: "reviewed", situation: "pricing" });
  });

  it("reads a label, odd casing or a single string as the id it means", () => {
    expect(validateExtractedTags({ method: "Desk research and benchmarks" }, ctx()).method).toEqual(["desk_research"]);
    expect(validateExtractedTags({ method: ["Stakeholder Interviews", "market-sizing"] }, ctx()).method).toEqual(["stakeholder_interviews", "market_sizing"]);
    expect(validateExtractedTags({ call_role: "Chief Financial Officer" }, call()).call_role).toBe("chief_financial_officer");
    expect(validateExtractedTags({ situation: "Setting the right price" }, ctx({ carrier: true })).situation).toBe("pricing");
  });

  it("stores a value outside the list as other, never as free text", () => {
    const tags = validateExtractedTags({ method: ["ethnography", "survey"], situation: "regulatory turnaround" }, ctx({ carrier: true }));
    expect(tags).toEqual({ method: ["survey", "other"], situation: "other" });
    expect(validateExtractedTags({ call_role: "head of procurement" }, call()).call_role).toBe("other");
    const stored = JSON.stringify([tags, validateExtractedTags({ call_role: "head of procurement" }, call())]);
    for (const free of ["ethnography", "regulatory", "procurement"]) expect(stored).not.toContain(free);
  });

  it("drops a stage outside the list, because the stage list has no other", () => {
    for (const stage of ["final", "v2", "shipped", "", 3, null, ["draft"]]) expect(validateExtractedTags({ stage }, ctx())).toEqual({});
  });

  it("never takes shown to client from a model: only a person's mark sets it", () => {
    expect(validateExtractedTags({ stage: "shown_to_client" }, ctx())).toEqual({});
    expect(validateExtractedTags({ stage: "draft" }, ctx({ shown: true }))).toEqual({ stage: "shown_to_client" });
    expect(validateExtractedTags({}, ctx({ shown: true }))).toEqual({ stage: "shown_to_client" });
  });

  it("drops wrong types, junk and missing keys without throwing", () => {
    for (const reply of [null, undefined, "method: survey", 7, [], [{ method: ["survey"] }], {}]) expect(validateExtractedTags(reply, call({ carrier: true }))).toEqual({});
    expect(validateExtractedTags({ method: [3, null, { id: "survey" }, ["survey"], true, ""], call_role: 12, stage: {}, situation: ["pricing"] }, call({ carrier: true }))).toEqual({});
    expect(validateExtractedTags({ method: { survey: true }, call_role: null }, call())).toEqual({});
  });

  it("drops overlong strings instead of calling them other", () => {
    const long = "x".repeat(MAX_TAG_CHARS + 1);
    expect(validateExtractedTags({ method: [long, "survey"], call_role: long, situation: long }, call({ carrier: true }))).toEqual({ method: ["survey"] });
    expect(validateExtractedTags({ method: Array.from({ length: 500 }, () => "survey") }, ctx()).method).toEqual(["survey"]);
  });

  it("drops a tag the item was not asked for", () => {
    expect(validateExtractedTags({ method: ["survey"], call_role: "founder", situation: "pricing", stage: "draft" }, ctx({ type: "ai_thread" }))).toEqual({ method: ["survey"] });
    expect(validateExtractedTags({ call_role: "founder", stage: "draft" }, call())).toEqual({ call_role: "founder" });
    expect(validateExtractedTags({ situation: "pricing" }, ctx({ carrier: false }))).toEqual({});
  });

  it("reads the reply's JSON through code fences, and treats anything else as no reply", () => {
    expect(parseTagReply('```json\n{"method":["survey"]}\n```')).toEqual({ method: ["survey"] });
    for (const raw of [null, "", "not json", '{"method": ["surv', "[1,2]", '"text"']) expect(parseTagReply(raw)).toBeNull();
  });
});

describe("a role is never a name", () => {
  const names = ["Harper Quinn", "Zoë Müller-Okonkwo", "St. Brigid Health", "Customer First Ltd", "Dean Park"];

  it("drops a role that equals or contains a known person or client name", () => {
    for (const role of ["Harper Quinn", "harper quinn", "CFO Harper Quinn", "Quinn", "harper", "St. Brigid Health", "St Brigid CFO", "brigid", "Zoe Muller-Okonkwo", "Müller", "okonkwo, chief nurse"]) {
      expect(nameInRole(role, names), role).toBe(true);
      expect(validateExtractedTags({ call_role: role }, call({ names })), role).toEqual({});
    }
  });

  it("keeps a real role when a name only shares a word with the list or a part of a word", () => {
    expect(validateExtractedTags({ call_role: "customer" }, call({ names })).call_role).toBe("customer");
    expect(validateExtractedTags({ call_role: "academic_leader" }, call({ names })).call_role).toBe("academic_leader");
    expect(nameInRole("parks director", names)).toBe(false);
    expect(nameInRole("", names)).toBe(false);
    expect(nameInRole("founder", ["", "  ", "A"])).toBe(false);
  });

  it("holds for the 40 check items against every person and client name in the demo firm", () => {
    const cases = tagCheckCases(DEMO_BOARDS).filter((entry) => entry.scored);
    expect(cases).toHaveLength(40);
    for (const entry of cases) {
      for (const name of ALL_NAMES) {
        for (const role of [name, `${name}, CFO`, name.split(" ")[0]!, name.toUpperCase()]) {
          const tags = validateExtractedTags({ method: entry.expected.method, call_role: role }, { type: "call", carrier: false, shown: false, names: ALL_NAMES });
          expect(tags.call_role === undefined || (ROLES as readonly string[]).includes(tags.call_role), `${entry.title}: ${role}`).toBe(true);
          expect(tags.call_role === undefined || !nameInRole(tags.call_role, ALL_NAMES)).toBe(true);
          if (role === name || role === `${name}, CFO`) expect(tags.call_role, `${entry.title}: ${role}`).toBeUndefined();
        }
      }
      // The label itself is a job title from the list and passes untouched.
      if (entry.expected.call_role) {
        expect(validateExtractedTags({ call_role: entry.expected.call_role }, { type: "call", carrier: false, shown: false, names: ALL_NAMES }).call_role).toBe(entry.expected.call_role);
      }
    }
  });

  it("never mistakes a role from the list for a demo name", () => {
    for (const role of ROLES) expect(nameInRole(role, ALL_NAMES), role).toBe(false);
  });
});

describe("storing the tags", () => {
  it("writes the keys the demo seed uses and leaves every other key alone", () => {
    const meta = { mime_type: "text/markdown", sow_facts: { fee_text: "$380k" }, firm_memory: "summary", role: "brief" };
    const next = mergeExtractedTags(meta, { method: ["survey"], stage: "draft" }, tagAskFor({ type: "document" }, false));
    expect(next).toEqual({ ...meta, method: ["survey"], stage: "draft" });
    expect(methodsOf(next)).toEqual(["survey"]);
    expect(stageOf(next)).toBe("draft");
  });

  it("replaces what it asked for, removes what no longer holds, and never touches a tag it did not ask for", () => {
    const before = { method: ["survey"], stage: "draft", call_role: "founder", situation: "pricing" };
    const next = mergeExtractedTags(before, { method: ["workshop"] }, tagAskFor({ type: "document" }, false));
    expect(next).toEqual({ method: ["workshop"], call_role: "founder", situation: "pricing" });
    expect(mergeExtractedTags(before, {}, NO_TAGS)).toEqual(before);
    expect(mergeExtractedTags(null, { method: ["survey"] }, tagAskFor({ type: "email" }, false))).toEqual({ method: ["survey"] });
    expect(mergeExtractedTags("junk", {}, tagAskFor({ type: "email" }, false))).toEqual({});
  });

  it("knows when nothing changed, so an extract that changed nothing writes nothing", () => {
    expect(sameStoredTags({ method: ["survey"], other: 1 }, { method: ["survey"], other: 2 })).toBe(true);
    expect(sameStoredTags({ method: ["survey"] }, { method: ["workshop"] })).toBe(false);
    expect(sameStoredTags({}, { stage: "draft" })).toBe(false);
  });
});

describe("a lead's correction", () => {
  const fields = tagFieldsFor({ type: "call" }, false);
  const now = new Date("2026-11-18T10:00:00Z");

  it("survives a re-extract: the readers keep the lead's values whatever the model writes next", () => {
    const built = buildTagCorrection({ method: ["expert_calls"], call_role: "chief_medical_officer" }, fields, "lead-1", now);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    let meta = withTagCorrection({ method: ["survey"], call_role: "founder" }, built.correction);
    for (let run = 0; run < 3; run += 1) {
      meta = mergeExtractedTags(meta, validateExtractedTags({ method: ["workshop", "data_analysis"], call_role: "buyer" }, call()), tagAskFor({ type: "call" }, false));
    }
    expect(meta[TAG_CORRECTION_KEY]).toEqual({ method: ["expert_calls"], call_role: "chief_medical_officer", by: "lead-1", at: "2026-11-18T10:00:00.000Z" });
    expect(meta["method"]).toEqual(["data_analysis", "workshop"]);
    expect(methodsOf(meta)).toEqual(["expert_calls"]);
    expect(roleOf(meta)).toBe("chief_medical_officer");
  });

  it("can say none, and that also survives", () => {
    const built = buildTagCorrection({ method: [], call_role: null }, fields, "lead-1", now);
    if (!built.ok) throw new Error("expected a correction");
    const meta = mergeExtractedTags(withTagCorrection({}, built.correction), { method: ["survey"], call_role: "founder" }, tagAskFor({ type: "call" }, false));
    expect(methodsOf(meta)).toEqual([]);
    expect(roleOf(meta)).toBeNull();
  });

  it("corrects only the tags it holds, and removing it brings back what Charlotte read", () => {
    const meta = { method: ["survey"], stage: "draft", [TAG_CORRECTION_KEY]: { stage: "reviewed" } };
    expect(stageOf(meta)).toBe("reviewed");
    expect(methodsOf(meta)).toEqual(["survey"]);
    expect(stageOf(withTagCorrection(meta, null))).toBe("draft");
    expect(situationOf({ situation: "pricing", [TAG_CORRECTION_KEY]: { situation: "talent" } })).toBe("talent");
    for (const junk of ["x", 3, ["a"], null]) expect(methodsOf({ method: ["survey"], [TAG_CORRECTION_KEY]: junk })).toEqual(["survey"]);
  });

  it("stores a value outside the list as other and refuses wrong types", () => {
    const loose = buildTagCorrection({ method: ["survey", "tea leaves"], call_role: "Harper Quinn" }, fields, "lead-1", now);
    expect(loose.ok && loose.correction).toMatchObject({ method: ["survey", "other"], call_role: "other" });
    expect(JSON.stringify(loose)).not.toMatch(/tea leaves|Harper/);
    for (const method of [undefined, null, "survey", [3], [{}], Array.from({ length: 21 }, () => "survey"), ["x".repeat(MAX_TAG_CHARS + 1)]]) {
      expect(buildTagCorrection({ method }, fields, "lead-1")).toEqual({ ok: false, problem: ITEM_TAGS_COPY.badMethod });
    }
    expect(buildTagCorrection({ method: [], call_role: 7 }, fields, "lead-1")).toEqual({ ok: false, problem: ITEM_TAGS_COPY.badRole });
    const deck = tagFieldsFor({ type: "deck" }, true);
    expect(buildTagCorrection({ method: [], stage: "final" }, deck, "lead-1")).toEqual({ ok: false, problem: ITEM_TAGS_COPY.badStage });
    expect(buildTagCorrection({ method: [], stage: "shown_to_client", situation: { a: 1 } }, deck, "lead-1")).toEqual({ ok: false, problem: ITEM_TAGS_COPY.badSituation });
  });

  it("keeps only the fields this item shows", () => {
    const built = buildTagCorrection({ method: ["survey"], call_role: "founder", stage: "draft", situation: "pricing" }, tagFieldsFor({ type: "ai_thread" }, false), "lead-1", now);
    expect(built.ok && built.correction).toEqual({ method: ["survey"], by: "lead-1", at: now.toISOString() });
    const deck = buildTagCorrection({ method: [], call_role: "founder", stage: "", situation: "pricing" }, tagFieldsFor({ type: "deck" }, true), "lead-1", now);
    expect(deck.ok && deck.correction).toEqual({ method: [], stage: null, situation: "pricing", by: "lead-1", at: now.toISOString() });
  });

  it("shows the dialog the tags as the firm reads them", () => {
    const view = itemTagsView({ type: "call", meta: { method: ["survey"], call_role: "founder", stage: "draft", [TAG_CORRECTION_KEY]: { call_role: "buyer" } } }, false);
    expect(view).toEqual({ method: ["survey"], call_role: "buyer", stage: null, situation: null, corrected: true, fields: { callRole: true, stage: false, situation: false } });
  });

  it("is for the board's lead and workspace admins only", () => {
    expect(canCorrectTags({ role: "admin", isBoardLead: false })).toBe(true);
    for (const role of ["lead", "em", "coach", null, undefined, "guest"]) {
      expect(canCorrectTags({ role, isBoardLead: false }), String(role)).toBe(false);
      expect(canCorrectTags({ role, isBoardLead: true }), String(role)).toBe(true);
    }
  });
});

describe("the item that carries the situation", () => {
  const item = (over: Partial<CarrierCandidate>): CarrierCandidate => ({ id: "i", type: "document", title: "Notes", visibility: "mapped", meta: {}, date: "2026-03-01", ...over });

  it("ranks a SOW first, then a brief, then a proposal, and nothing else", () => {
    expect(situationRank(item({ meta: { sow_facts: { fee_text: "$380k" } } }))).toBe(1);
    for (const title of ["SOW: Project Heron", "Statement of Work v3", "Heron scope of work", "Engagement letter"]) expect(situationRank(item({ title })), title).toBe(1);
    expect(situationRank(item({ meta: { role: "brief" } }))).toBe(2);
    for (const title of ["Client brief", "RFP from Heron"]) expect(situationRank(item({ title })), title).toBe(2);
    expect(situationRank(item({ meta: { deliverable_kind: "proposal" } }))).toBe(3);
    for (const title of ["Briefing notes", "Debrief", "Interview guide", "Sowing plan"]) expect(situationRank(item({ title })), title).toBeNull();
    expect(situationRank(item({ type: "call", title: "SOW call" }))).toBeNull();
  });

  it("never picks a private item, so the situation is always somewhere the firm can read", () => {
    expect(situationRank(item({ title: "SOW", visibility: "private" }))).toBeNull();
    expect(situationRank(item({ title: "SOW", visibility: "unmapped" }))).toBeNull();
    expect(situationCarrierId([item({ id: "private-sow", title: "SOW", visibility: "private" }), item({ id: "brief", title: "Client brief" })])).toBe("brief");
  });

  it("picks one item per board, the same one every time", () => {
    const board = [
      item({ id: "c", title: "Client brief", date: "2026-01-01" }),
      item({ id: "b", title: "SOW v2", date: "2026-02-10" }),
      item({ id: "a", title: "SOW v1", date: "2026-02-10" }),
      item({ id: "d", title: "Findings deck", type: "deck" }),
    ];
    expect(situationCarrierId(board)).toBe("a");
    expect(situationCarrierId([...board].reverse())).toBe("a");
    expect(situationCarrierId([item({ id: "x" }), item({ id: "y", type: "call" })])).toBeNull();
    expect(situationCarrierId([])).toBeNull();
  });

  it("lets the lead's own choice win, and lets a lead name a carrier on a board with no SOW or brief", () => {
    const chosen = item({ id: "deck", type: "deck", title: "Kickoff", meta: { [TAG_CORRECTION_KEY]: { situation: "talent" } } });
    const sow = item({ id: "sow", title: "SOW" });
    expect(situationCarrierId([sow, chosen])).toBe("deck");
    expect(canHoldSituation(sow, [sow, chosen])).toBe(false);
    const plain = item({ id: "plain" });
    expect(canHoldSituation(plain, [plain, item({ id: "other" })])).toBe(true);
    expect(canHoldSituation(item({ id: "call", type: "call" }), [])).toBe(false);
    expect(canHoldSituation(item({ id: "mine", visibility: "private" }), [])).toBe(false);
  });
});

describe("what the tags add to the call", () => {
  it("adds a small, bounded number of tokens, with the long lists kept to the items that need them", () => {
    const document = tagTokenEstimate(tagAskFor({ type: "document" }, false));
    const thread = tagTokenEstimate(tagAskFor({ type: "ai_thread" }, false));
    const aCall = tagTokenEstimate(tagAskFor({ type: "call" }, false));
    const carrier = tagTokenEstimate(tagAskFor({ type: "document" }, true));
    console.log("[step 5 cost] estimated extra tokens per item (in/out):", { document, thread, call: aCall, carrier });
    expect(tagTokenEstimate(NO_TAGS)).toEqual({ tokensIn: 0, tokensOut: 0 });
    expect(thread.tokensIn).toBeLessThanOrEqual(110);
    expect(document.tokensIn).toBeLessThanOrEqual(140);
    expect(document.tokensOut).toBeLessThanOrEqual(20);
    expect(aCall.tokensIn).toBeLessThanOrEqual(320);
    expect(aCall.tokensOut).toBeLessThanOrEqual(25);
    expect(carrier.tokensOut).toBeLessThanOrEqual(30);
  });
});
