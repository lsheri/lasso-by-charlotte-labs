import { describe, expect, it } from "vitest";

import { GROUP_IDS } from "@/components/tour/TourActs";
import { TOUR_BOARD_LAYOUT, actById, tourAmbientCards } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;
const CHAT_SOURCES = new Set(["claude", "chatgpt", "gemini"]);

function cardsFor(register: (typeof REGISTERS)[number]) {
  return actById(register, 2)?.cards ?? [];
}
function cardAt(register: (typeof REGISTERS)[number], id: string) {
  const index = Number(id.split("-")[1]);
  return id.startsWith("primary-") ? cardsFor(register)[index] : undefined;
}

describe("TV1 cross-vendor grouped set", () => {
  it("names three primary slots holding one drive document and two chats from different vendors", () => {
    expect(GROUP_IDS).toHaveLength(3);
    for (const register of REGISTERS) {
      const sources = GROUP_IDS.map((id) => cardAt(register, id)?.source);
      expect(sources.filter((source) => source === "drive")).toHaveLength(1);
      const chats = sources.filter((source): source is string => !!source && CHAT_SOURCES.has(source));
      expect(chats).toHaveLength(2);
      expect(chats[0]).not.toBe(chats[1]);
      for (const id of GROUP_IDS) expect(TOUR_BOARD_LAYOUT.some((item) => item.id === id)).toBe(true);
    }
  });

  it("marks exactly the GROUP_IDS cards inSet", () => {
    for (const register of REGISTERS) {
      const inSet = cardsFor(register).flatMap((card, index) => (card.inSet ? [`primary-${index}`] : []));
      expect(inSet).toEqual([...GROUP_IDS]);
    }
  });

  it("keeps the Granola creator call on the board and out of the set", () => {
    for (const register of REGISTERS) {
      const index = cardsFor(register).findIndex((card) => card.title === "Creator call, 14 Sep");
      expect(index).toBeGreaterThanOrEqual(0);
      const card = cardsFor(register)[index];
      expect(card?.source).toBe("granola");
      expect(card?.inSet).toBe(false);
      expect(GROUP_IDS).not.toContain(`primary-${index}`);
      expect(TOUR_BOARD_LAYOUT.some((item) => item.id === `primary-${index}`)).toBe(true);
    }
  });

  it("cites a claude chat, a chatgpt chat and the drive document in the answer", () => {
    for (const register of REGISTERS) {
      const byTitle = new Map(cardsFor(register).map((card) => [card.title, card.source]));
      const cited = (actById(register, 4)?.answer ?? []).map((claim) => byTitle.get(claim.sourceCardTitle));
      expect(cited).toContain("claude");
      expect(cited).toContain("chatgpt");
      expect(cited).toContain("drive");
    }
  });

  it("never repeats a title between grouped cards and side chats", () => {
    for (const register of REGISTERS) {
      const titles = [...cardsFor(register), ...tourAmbientCards(register)].map((card) => card.title);
      expect(new Set(titles).size).toBe(titles.length);
    }
  });
});
