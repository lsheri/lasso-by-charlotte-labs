// 18 Nov: Firm Brain Build Spec, step 1. Fixed lists for what an engagement was about (situation) and how the team
// did it (methods), a stage for deliverables and a job title for calls, seeded into the demo firm's work_items.meta.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { itemTags, seedMeta, situationCarrier, stageFor } from "@/lib/demo-firm/plan";
import {
  METHOD_LABELS,
  METHODS,
  methodsOf,
  ROLE_LABELS,
  ROLES,
  roleOf,
  SITUATION_LABELS,
  SITUATIONS,
  situationOf,
  STAGES,
  stageOf,
} from "@/lib/engagement-tags";

const seeded = DEMO_BOARDS.flatMap((board) => board.items.map((item) => ({ board, item, meta: seedMeta(board, item) })));

/** A whole word, case-insensitive, so "Park" does not match "Parks". */
const mentions = (text: string, word: string) => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

describe("the fixed lists", () => {
  it("are about ten situations and twelve methods, each ending in other, with a label for every value", () => {
    expect(SITUATIONS.length).toBeGreaterThanOrEqual(9);
    expect(SITUATIONS.length).toBeLessThanOrEqual(13);
    expect(METHODS.length).toBeGreaterThanOrEqual(11);
    expect(METHODS.length).toBeLessThanOrEqual(15);
    for (const list of [SITUATIONS, METHODS, ROLES]) expect(list[list.length - 1]).toBe("other");
    expect(Object.keys(SITUATION_LABELS)).toEqual([...SITUATIONS]);
    expect(Object.keys(METHOD_LABELS)).toEqual([...METHODS]);
    expect(Object.keys(ROLE_LABELS)).toEqual([...ROLES]);
    expect(STAGES).toEqual(["draft", "reviewed", "shown_to_client"]);
  });

  it("reads an unknown string as other, so a typed name never surfaces, and ignores anything that is not a string", () => {
    expect(situationOf({ situation: "pricing" })).toBe("pricing");
    expect(situationOf({ situation: "something new" })).toBe("other");
    expect(situationOf({ situation: 4 })).toBeNull();
    expect(situationOf(null)).toBeNull();
    expect(methodsOf({ method: ["workshop", "survey", "workshop", "made up", 7] })).toEqual(["survey", "workshop", "other"]);
    expect(methodsOf({ method: "survey" })).toEqual(["survey"]);
    expect(methodsOf({})).toEqual([]);
    expect(roleOf({ call_role: "chief_financial_officer" })).toBe("chief_financial_officer");
    expect(roleOf({ call_role: "Maren Hollis" })).toBe("other");
    // meta.role belongs to the brief marker, never to a call's job title.
    expect(roleOf({ role: "brief" })).toBeNull();
    expect(stageOf({ stage: "reviewed" })).toBe("reviewed");
    expect(stageOf({ stage: "final" })).toBeNull();
  });
});

describe("the seeded tags", () => {
  it("are every one a value from the fixed lists, or other", () => {
    let tags = 0;
    for (const { board, item, meta } of seeded) {
      const where = `${board.key}.${item.key}`;
      if ("situation" in meta) expect(SITUATIONS, where).toContain(meta["situation"]);
      if ("method" in meta) {
        expect(Array.isArray(meta["method"]), where).toBe(true);
        for (const method of meta["method"] as string[]) expect(METHODS, where).toContain(method);
      }
      if ("call_role" in meta) expect(ROLES, where).toContain(meta["call_role"]);
      if ("stage" in meta) expect(STAGES, where).toContain(meta["stage"]);
      expect(meta, where).not.toHaveProperty("role");
      tags += Object.keys(itemTags(board, item)).length;
    }
    expect(tags).toBeGreaterThan(300);
  });

  it("give every shared engagement exactly one situation, on its SOW", () => {
    const shared = DEMO_BOARDS.filter((board) => board.sharedWithFirm);
    expect(shared.length).toBeGreaterThan(20);
    for (const board of shared) {
      const carriers = seeded.filter((entry) => entry.board === board && "situation" in entry.meta);
      expect(carriers.map((entry) => entry.item.key), board.key).toEqual(["sow"]);
      expect(carriers[0]!.meta["situation"]).toBe(board.situation);
    }
  });

  it("give a board with no SOW its situation on its earliest placed, non-private document", () => {
    const pursuits = DEMO_BOARDS.filter((board) => !board.items.some((item) => item.key === "sow"));
    expect(pursuits.map((board) => board.key)).toEqual(["b31", "b32", "b33"]);
    for (const board of pursuits) {
      const carriers = seeded.filter((entry) => entry.board === board && "situation" in entry.meta);
      expect(carriers).toHaveLength(1);
      expect(carriers[0]!.item.type).toBe("document");
      expect(carriers[0]!.item.visibility).not.toBe("private");
    }
    const board = (items: { key: string; type: "document" | "call" | "email"; date: string; visibility?: "private"; placed?: boolean }[]) =>
      ({ items }) as never;
    expect(situationCarrier(board([{ key: "note", type: "document", date: "2025-01-02" }, { key: "sow", type: "document", date: "2025-01-05" }]))).toBe("sow");
    expect(
      situationCarrier(
        board([
          { key: "secret", type: "document", date: "2025-01-01", visibility: "private" },
          { key: "loose", type: "document", date: "2025-01-01", placed: false },
          { key: "ask", type: "email", date: "2025-01-02" },
          { key: "notes", type: "document", date: "2025-01-03" },
        ]),
      ),
    ).toBe("notes");
    expect(situationCarrier(board([{ key: "ask", type: "email", date: "2025-01-02" }]))).toBe("ask");
    expect(situationCarrier(board([]))).toBeNull();
  });

  it("put a job title on every external call and never a person's or client's name", () => {
    const names = DEMO_PEOPLE.flatMap((person) => [person.name, ...person.name.split(/\s+/)]);
    const clients = DEMO_BOARDS.map((board) => board.client.name);
    const calls = seeded.filter((entry) => entry.item.type === "call");
    const titled = calls.filter((entry) => "call_role" in entry.meta);
    // The one internal debrief has no outside party, so no role.
    expect(calls.length - titled.length).toBe(1);
    for (const { board, item, meta } of titled) {
      const role = meta["call_role"] as keyof typeof ROLE_LABELS;
      for (const text of [role, ROLE_LABELS[role]]) {
        for (const name of [...names, ...clients]) expect(mentions(text, name), `${board.key}.${item.key}: ${text} names ${name}`).toBe(false);
      }
    }
    for (const role of ROLES) {
      for (const name of [...names, ...clients]) expect(mentions(ROLE_LABELS[role], name), `${role} names ${name}`).toBe(false);
    }
  });

  it("are the same when the seed is planned twice", () => {
    const again = DEMO_BOARDS.flatMap((board) => board.items.map((item) => seedMeta(board, item)));
    expect(again).toEqual(seeded.map((entry) => entry.meta));
    // A planned array is a copy, so a writer that changes it cannot change the next plan.
    const first = seeded.find((entry) => Array.isArray(entry.meta["method"]))!;
    (first.meta["method"] as string[]).push("other");
    expect(seedMeta(first.board, first.item)["method"]).not.toContain("other");
    (first.meta["method"] as string[]).pop();
  });

  it("stage deliverables from the data: shown means shown to client, a draft title means draft", () => {
    expect(stageFor({ type: "deck", title: "Final readout", shown: [{ on: "2025-01-01", occasion: "SteerCo" }] })).toBe("shown_to_client");
    expect(stageFor({ type: "deck", title: "Pricing deck draft v1 (internal)" })).toBe("draft");
    expect(stageFor({ type: "sheet", title: "Sizing model v3" })).toBe("reviewed");
    expect(stageFor({ type: "call", title: "Interview: Chief Financial Officer" })).toBeNull();
    for (const { item, meta } of seeded) if (item.shown?.length) expect(meta["stage"]).toBe("shown_to_client");
  });
});
