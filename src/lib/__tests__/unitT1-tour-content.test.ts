import { describe, expect, it } from "vitest";

import { TOUR_AMBIENT_CARDS, TOUR_BOARD_LAYOUT, TOUR_CONTENT, tourAmbientCards, tourBoardCopy } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const FORBIDDEN = /\u2014|\baudit\b|\boversight\b|\bmonitor\b|\btrack\b|\bsurveillance\b|\bgovernance\b|\bscore\b/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("T1 tour content", () => {
  it("defines five complete acts for every register", () => {
    expect(Object.keys(TOUR_CONTENT).sort()).toEqual([...REGISTERS].sort());
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      expect(acts).toHaveLength(5);
      expect(acts.map((act) => act.id)).toEqual([1, 2, 3, 4, 5]);
      const cards = acts[1]?.cards ?? [];
      expect(cards).toHaveLength(5);
      expect(cards.filter((card) => card.inSet)).toHaveLength(3);
    }
  });

  it("ties every answer claim to one selected card in the same register", () => {
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      const selected = new Set((acts[1]?.cards ?? []).filter((card) => card.inSet).map((card) => card.title));
      const answer = acts[3]?.answer ?? [];
      expect(answer).toHaveLength(3);
      for (const claim of answer) expect(selected.has(claim.sourceCardTitle)).toBe(true);
      expect(selected.has(acts[3]?.chatLink?.cardTitle ?? "")).toBe(true);
    }
  });

  it("keeps every content string within the language rules", () => {
    for (const value of strings(TOUR_CONTENT)) expect(value).not.toMatch(FORBIDDEN);
  });

  it("gives every act a plain instruction and reason", () => {
    for (const register of REGISTERS) {
      for (const act of TOUR_CONTENT[register].acts) {
        expect(act.captionPointer.length).toBeGreaterThan(0);
        expect(act.captionTouch.length).toBeGreaterThan(0);
        expect(act.why.length).toBeGreaterThan(0);
      }
    }
  });

  it("pins the one-click work-card instruction", () => {
    for (const register of REGISTERS) {
      expect(TOUR_CONTENT[register].acts[1]?.captionPointer).toBe("Click one of the outlined work cards.");
      expect(TOUR_CONTENT[register].acts[1]?.captionTouch).toBe("Click one of the outlined work cards.");
      expect(TOUR_CONTENT[register].acts[1]?.why).toBe("You are telling Lasso which work, AI chats and transcripts share context. These three all went into the same final piece of work.");
    }
  });

  it("pins the free form card layouts and AI chat plurality", () => {
    expect(TOUR_AMBIENT_CARDS).toHaveLength(4);
    expect(TOUR_AMBIENT_CARDS.map((card) => card.source)).toEqual(["chatgpt", "chatgpt", "gemini", "claude"]);
    for (const [index, card] of TOUR_AMBIENT_CARDS.entries()) {
      expect(card.excerpt).toHaveLength(2);
      const layout = TOUR_BOARD_LAYOUT.find((item) => item.id === `chat-${index}`);
      expect(layout).toBeTruthy();
      expect(Math.abs(layout?.rotation ?? 2)).toBeLessThan(1.5);
    }
    for (const register of REGISTERS) {
      for (const [index, card] of (TOUR_CONTENT[register].acts[1]?.cards ?? []).entries()) {
        expect(card.preview).toHaveLength(2);
        const layout = TOUR_BOARD_LAYOUT.find((item) => item.id === `primary-${index}`);
        expect(layout).toBeTruthy();
        expect(Math.abs(layout?.rotation ?? 2)).toBeLessThan(1.5);
      }
    }
  });

  it("pins the company fall launch scenario and its cited sources", () => {
    const acts = TOUR_CONTENT.company.acts;
    expect(acts[1]?.cards?.map((card) => card.title)).toEqual([
      "Fall launch plan v3",
      "Creator call, 14 Sep",
      "Claude: channel mix options",
      "Media budget v4",
      "Sample shipping receipts",
    ]);
    expect(acts[3]?.question).toBe("What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.");
    expect(acts[3]?.answer).toEqual([
      { text: "You floated a TikTok first launch and dropped it after the creator call.", sourceCardTitle: "Claude: channel mix options" },
      { text: "Toronto came up on the call and never reached the plan.", sourceCardTitle: "Creator call, 14 Sep" },
      { text: "The plan kept Austin and Denver only.", sourceCardTitle: "Fall launch plan v3" },
    ]);
    expect(tourAmbientCards("company").map((card) => card.title)).toEqual([
      "ChatGPT: athleisure trend teardown",
      "ChatGPT: creator brief, draft 2",
      "Gemini: city by city demand",
      "Claude: positioning lines",
    ]);
    expect(tourBoardCopy("company")).toMatchObject({ title: "Fall Marketing Launch", owner: "LYKOS LOUNGEWARE", whiteboardTitle: "Moodboard photo", whiteboardCaption: "Shots from the fabric session", deckTitle: "Launch deck, slide 12" });
  });
});