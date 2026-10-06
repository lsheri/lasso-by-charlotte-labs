import { describe, expect, it } from "vitest";

import { TOUR_AMBIENT_CARDS, TOUR_BOARD_LAYOUT, TOUR_CONTENT, TOUR_PUSHED_CHAT, tourAmbientCards, tourBoardCopy } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const FORBIDDEN = /\u2014|\baudit\b|\boversight\b|\bmonitor\b|\btrack\b|\bsurveillance\b|\bgovernance\b|\bscore\b/i;

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

describe("T1 tour content", () => {
  it("defines eight complete acts for every register", () => {
    expect(Object.keys(TOUR_CONTENT).sort()).toEqual([...REGISTERS].sort());
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      expect(acts).toHaveLength(8);
      expect(acts.map((act) => act.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
      const cards = acts[3]?.cards ?? [];
      expect(cards).toHaveLength(5);
      expect(cards.filter((card) => card.inSet)).toHaveLength(3);
    }
  });

  it("ties every answer claim to one selected card in the same register", () => {
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      const selected = new Set((acts[3]?.cards ?? []).filter((card) => card.inSet).map((card) => card.title));
      const answer = acts[5]?.answer ?? [];
      expect(answer).toHaveLength(3);
      for (const claim of answer) expect(selected.has(claim.sourceCardTitle)).toBe(true);
      expect(selected.has(acts[5]?.chatLink?.cardTitle ?? "")).toBe(true);
    }
  });

  it("keeps every content string within the language rules", () => {
    for (const value of strings(TOUR_CONTENT)) expect(value).not.toMatch(FORBIDDEN);
  });

  it("gives every act a plain instruction and reason", () => {
    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      for (const act of acts) {
        expect(act.captionPointer.length).toBeGreaterThan(0);
        expect(act.captionTouch.length).toBeGreaterThan(0);
        expect(act.why.length).toBeGreaterThan(0);
        expect(act.why).not.toBe(act.captionPointer);
      }
      expect(new Set(acts.map((act) => act.why)).size).toBe(acts.length);
    }
  });

  it("pins the one-click work-card instruction", () => {
    for (const register of REGISTERS) {
      expect(TOUR_CONTENT[register].acts[3]?.captionPointer).toBe("On your board, add groupings to specify which context cards share the same work stream");
      expect(TOUR_CONTENT[register].acts[3]?.captionTouch).toBe("Tap one of the outlined cards.");
      expect(TOUR_CONTENT[register].acts[3]?.why).toBe("Lasso can answer from a full board, single piece of work, or grouped works treams. Think of each card as \"context\" for Lasso's AI chat.");
      expect(TOUR_CONTENT[register].acts[4]?.captionPointer).toBe("Draw a box around the three selected cards.");
      expect(TOUR_CONTENT[register].acts[4]?.captionTouch).toBe("Tap Add grouping to group the three cards.");
      expect(TOUR_CONTENT[register].acts[4]?.why).toBe("We are deciding that these pieces of work should share the same context.");
    }
  });

  it("pins the free form card layouts and AI chat plurality", () => {
    expect(TOUR_AMBIENT_CARDS).toHaveLength(4);
    expect(TOUR_AMBIENT_CARDS.map((card) => card.source)).toEqual(["chatgpt", "chatgpt", "gemini", "claude"]);
    for (const [index, card] of TOUR_AMBIENT_CARDS.slice(0, 2).entries()) {
      expect(card.excerpt).toHaveLength(2);
      const layout = TOUR_BOARD_LAYOUT.find((item) => item.id === `chat-${index}`);
      expect(layout).toBeTruthy();
      expect(Math.abs(layout?.rotation ?? 2)).toBeLessThan(1.5);
    }
    for (const register of REGISTERS) {
      for (const [index, card] of (TOUR_CONTENT[register].acts[3]?.cards ?? []).entries()) {
        expect(card.preview).toHaveLength(2);
        const layout = TOUR_BOARD_LAYOUT.find((item) => item.id === `primary-${index}`);
        if (index === 4) expect(layout).toBeUndefined();
        else {
          expect(layout).toBeTruthy();
          expect(Math.abs(layout?.rotation ?? 2)).toBeLessThan(1.5);
        }
      }
    }
  });

  it("pins the shared fall launch scenario and each register grouping word", () => {
    const expectedTitles = [
      "Fall launch plan v3",
      "ChatGPT: creator brief, draft 2",
      "Claude: channel mix options",
      "Creator call, 14 Sep",
      "Sample shipping receipts",
    ];
    const expectedQuestion = "What ideas did I have that did not make the final launch plan? Give me the link to the AI chat I worked them out in.";
    const expectedAnswer = [
      { text: "You floated a TikTok first launch and dropped it.", sourceCardTitle: "Claude: channel mix options" },
      { text: "Toronto made the creator brief and never reached the plan.", sourceCardTitle: "ChatGPT: creator brief, draft 2" },
      { text: "The plan kept Austin and Denver only.", sourceCardTitle: "Fall launch plan v3" },
    ];
    const expectedAmbientTitles = [
      "ChatGPT: athleisure trend teardown",
      "ChatGPT: seeding partner outreach",
      "Gemini: city by city demand",
      "Claude: positioning lines",
    ];
    const expectedFrameTitles = {
      company: "Workstream",
      partner: "Workstream",
      personal: "Step",
      edu: "Assignment",
    } as const;

    for (const register of REGISTERS) {
      const acts = TOUR_CONTENT[register].acts;
      expect(acts[3]?.cards?.map((card) => card.title)).toEqual(expectedTitles);
      expect(acts[5]?.question).toBe(expectedQuestion);
      expect(acts[5]?.answer).toEqual(expectedAnswer);
      expect(acts[5]?.chatLink).toEqual({ label: "Open the chat", cardTitle: "Claude: channel mix options" });
      expect(acts[2]?.bringIn).toEqual({ title: TOUR_PUSHED_CHAT.title, source: TOUR_PUSHED_CHAT.source });
      expect(acts[2]?.bringIn?.title).toBe(acts[3]?.cards?.[2]?.title);
      expect(acts[4]?.frameTitle).toBe(expectedFrameTitles[register]);
      expect(acts[4]?.why).toBe("We are deciding that these pieces of work should share the same context.");
      expect(tourAmbientCards(register).map((card) => card.title)).toEqual(expectedAmbientTitles);
      expect(tourBoardCopy(register)).toMatchObject({ title: "Fall Marketing Launch", owner: "LYKOS LOUNGEWARE", whiteboardTitle: "Austin retail launch page", whiteboardCaption: "Store page draft", deckTitle: "Launch deck, slide 12" });
      expect(tourBoardCopy(register).pieceCount).toBe(TOUR_BOARD_LAYOUT.filter((item) => item.earliestAct <= 3).length);
    }
    expect(REGISTERS.map((register) => TOUR_CONTENT[register].acts[4]?.frameTitle)).toEqual([
      "Workstream",
      "Workstream",
      "Step",
      "Assignment",
    ]);
  });
});