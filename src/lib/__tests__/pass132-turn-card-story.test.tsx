import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { turnConnectorD } from "@/lib/journey-path";
import {
  TURN_STORY_WINDOW,
  stripMarkdown,
  turnCardDx,
  turnCards,
  turnSnippet,
  turnStoryWindow,
} from "@/lib/turn-story-shared";

const STORY = readFileSync("src/components/verify/TurnCardStory.tsx", "utf8");
const SHARED = readFileSync("src/lib/turn-story-shared.ts", "utf8");
const READER = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");

const TURNS = [
  { id: "t2", turn_no: 2, role: "assistant", content: "**Bold** answer with `code` and more" },
  { id: "t1", turn_no: 1, role: "user", content: "# Ask\nWhat did we decide" },
  { id: "t3", turn_no: 3, role: "user", content: "x".repeat(200) },
];

describe("pass 132 card derivation", () => {
  it("makes one card per turn, in turn order", () => {
    const cards = turnCards("item-a", TURNS);
    expect(cards.map((c) => c.turnNo)).toEqual([1, 2, 3]);
    expect(cards.map((c) => c.id)).toEqual(["t1", "t2", "t3"]);
  });

  it("marks only assistant turns as vendor-logo turns", () => {
    const cards = turnCards("item-a", TURNS);
    expect(cards.map((c) => c.isAssistant)).toEqual([false, true, false]);
    expect(cards[1]?.label).toBe("TURN 2 · ASSISTANT");
    expect(cards[0]?.label).toBe("TURN 1 · USER");
  });

  it("strips markdown and ellipsizes the snippet", () => {
    expect(stripMarkdown("# Head\n**bold** `x` [link](http://a)")).toBe("Head bold x link");
    expect(turnCards("item-a", TURNS)[1]?.snippet).toBe("Bold answer with code and more");
    const long = turnSnippet("y".repeat(200));
    expect(long.length).toBe(60);
    expect(long.endsWith("…")).toBe(true);
  });

  it("reuses the existing vendor icon component, never a second icon set", () => {
    expect(STORY).toContain("SourceMark");
    expect(STORY).toContain("sourceVendorKey");
    expect(STORY).toContain('name="messages"');
  });
});

describe("pass 132 seeded layout", () => {
  it("is deterministic per item and turn, and differs between chats", () => {
    expect(turnCardDx("item-a", 3)).toBe(turnCardDx("item-a", 3));
    expect(turnCardDx("item-a", 3)).not.toBe(turnCardDx("item-b", 3));
  });

  it("snakes side to side", () => {
    expect(turnCardDx("item-a", 1)).toBeGreaterThan(0);
    expect(turnCardDx("item-a", 2)).toBeLessThan(0);
  });

  it("uses no Math.random anywhere in the new code", () => {
    for (const text of [STORY, SHARED]) expect(text).not.toContain("Math.random");
  });
});

describe("pass 132 connectors", () => {
  it("lives in journey-path and draws a graphite curve with an arrowhead", () => {
    const connector = turnConnectorD("item-a:2", { x: 10, y: 0 }, { x: 60, y: 80 });
    expect(connector.stroke.d.startsWith("M")).toBe(true);
    expect(connector.stroke.length).toBeGreaterThan(0);
    expect(connector.arrow).toHaveLength(2);
    expect(turnConnectorD("item-a:2", { x: 10, y: 0 }, { x: 60, y: 80 }).stroke.d).toBe(
      connector.stroke.d,
    );
  });

  it("keeps every drawn path out of the surfaces", () => {
    for (const text of [STORY, READER]) {
      expect(text).not.toMatch(/d="M[\s\d]/);
    }
    expect(STORY).toContain("nb-journey-seg");
    expect(STORY).toContain("nb-journey-arrow");
  });

  it("carries no verdict ink", () => {
    for (const text of [STORY, SHARED]) {
      expect(text).not.toContain("nb-ink-ember");
      expect(text).not.toContain("--destructive");
    }
  });
});

describe("pass 132 window and hygiene", () => {
  it("shows at most six cards at once for a long chat", () => {
    const cards = Array.from({ length: 30 }, (_, i) => ({
      id: `t${i + 1}`,
      turn_no: i + 1,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `turn ${i + 1}`,
    }));
    expect(TURN_STORY_WINDOW).toBe(6);
    expect(turnStoryWindow(turnCards("item-a", cards), 30)).toHaveLength(6);
    expect(turnStoryWindow(turnCards("item-a", cards), 3)).toHaveLength(3);
    expect(turnStoryWindow(turnCards("item-a", cards), 0)).toHaveLength(0);
  });

  it("renders static cards under reduced motion and nothing when stacked", () => {
    expect(STORY).toContain('data-reduced="true"');
    expect(STORY).toContain("cards.slice(0, 3)");
    expect(STORY).toContain("if (!wide || cards.length === 0) return null;");
  });

  it("owns its timers and hands back a stop", () => {
    expect(STORY).toContain("const stop = useCallback(");
    expect(STORY).toContain("window.clearTimeout");
    expect(STORY).toContain("return { head, stop };");
    expect(STORY).toContain("if (!running) stop();");
  });

  it("adds no query and no event", () => {
    expect(STORY).not.toContain("supabase");
    expect(STORY).not.toContain("logEvent");
    expect(STORY).not.toContain("logV2");
    expect(READER).toContain('queryKey: ["turns", request.itemId]');
  });
});
