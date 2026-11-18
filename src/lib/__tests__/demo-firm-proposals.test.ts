// 17 Nov: the demo seed top-up for Ask the firm and Start a proposal (firm-brain-review RECOMMENDATION section 10).
// Six client-shown proposals in one structure, SOW terms as data, an unshared incoming opportunity, and two candid
// notes on a shared board so the candid-notes rule has something to keep out.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { itemMeta, nextSlot, sowFacts } from "@/lib/demo-firm/plan";

const board = (key: string) => DEMO_BOARDS.find((entry) => entry.key === key)!;
const headings = (body: string) => [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);

describe("SOW terms as data", () => {
  it("reads fixed and monthly fees, and keeps only the text of anything else", () => {
    expect(sowFacts({ fee: "$380k", weeks: 16 })).toEqual({ fee_text: "$380k", fee_amount: 380000, fee_basis: "fixed", weeks: 16 });
    expect(sowFacts({ fee: "$45k/month", weeks: 26 })).toMatchObject({ fee_amount: 45000, fee_basis: "monthly" });
    expect(sowFacts({ fee: "To be agreed", weeks: 12 })).toMatchObject({ fee_amount: null, fee_basis: null });
  });

  it("puts the terms on the SOW item only, and the kind on proposals only", () => {
    const b05 = board("b5");
    expect(itemMeta(b05, { key: "sow" })).toEqual({ sow_facts: sowFacts(b05) });
    expect(itemMeta(b05, { key: "proposal", kind: "proposal" })).toEqual({ deliverable_kind: "proposal" });
    expect(itemMeta(b05, { key: "steerco1" })).toEqual({});
  });

  it("can read a fee off every board's SOW", () => {
    for (const entry of DEMO_BOARDS.filter((b) => !b.pursuit)) {
      expect(entry.items.some((item) => item.key === "sow")).toBe(true);
      expect(sowFacts(entry).fee_amount).not.toBeNull();
    }
  });
});

describe("what good looks like", () => {
  const proposals = DEMO_BOARDS.flatMap((entry) => entry.items.filter((item) => item.kind === "proposal").map((item) => ({ entry, item })));

  it("has six proposals on shared boards, each shown to the client", () => {
    expect(proposals.map(({ entry }) => entry.key).sort()).toEqual(["b11", "b17", "b26", "b5", "b6", "b9"]);
    for (const { entry, item } of proposals) {
      expect(entry.sharedWithFirm).toBe(true);
      expect(item.shown?.length).toBeGreaterThan(0);
    }
  });

  it("writes every proposal in the same section order, with the fee under its own heading", () => {
    const order = headings(proposals[0]!.item.body!);
    expect(order).toContain("Fees");
    for (const { item } of proposals) expect(headings(item.body!)).toEqual(order);
  });

  it("states the same fee in each proposal as in its SOW", () => {
    for (const { entry, item } of proposals) {
      const amount = sowFacts(entry).fee_amount!;
      const fees = item.body!.split("## Fees")[1]!.split("##")[0]!;
      expect(fees).toContain(`$${amount.toLocaleString("en-US")}`);
    }
  });
});

describe("the incoming opportunity", () => {
  const b31 = board("b31");

  it("is an unshared pursuit owned by the proposal owner, so it never feeds the brain", () => {
    expect(b31).toMatchObject({ pursuit: true, status: "active", sharedWithFirm: false });
    expect(b31.team[0]).toBe("quinn");
  });

  it("has precedents the firm can read", () => {
    for (const key of ["b5", "b6", "b7"]) expect(board(key).sharedWithFirm).toBe(true);
  });
});

describe("planted candid notes", () => {
  const b06 = board("b6");
  const call = b06.items.find((item) => item.key === "cfo-checkin")!;
  const chat = b06.items.find((item) => item.key === "sponsor-chat")!;

  it("sit placed and not private on a shared board, where only the candid-notes rule keeps them out", () => {
    expect(b06.sharedWithFirm).toBe(true);
    for (const item of [call, chat]) {
      expect(item.visibility).toBeUndefined();
      expect(item.placed).toBeUndefined();
    }
    expect(call.body).toContain("The CFO is difficult and will stall on the payer numbers");
    expect(chat.turns![0]!.content).toContain("oversells to the board");
  });

  it("keep the opinion out of their summaries, which the firm may read", () => {
    for (const item of [call, chat]) expect(item.summary).not.toMatch(/difficult|stall|oversell/i);
  });
});

describe("cards added to a seeded board", () => {
  const frame = { x: 0, y: 0, h: 600 };

  it("go in the next free slot", () => {
    expect(nextSlot(frame, 0)).toMatchObject({ x: 40, y: 80, frameH: 600 });
    expect(nextSlot(frame, 4)).toMatchObject({ x: 340, y: 340 });
  });

  it("grow the frame when the slot needs another row", () => {
    expect(nextSlot(frame, 6).frameH).toBe(600 + 260);
  });
});
