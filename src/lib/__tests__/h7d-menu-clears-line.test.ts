import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { menuPlacement } from "@/components/canvas-lab/ask-draft/ContinueInAI";

const viewport = { width: 1728, height: 871 };
const button = { top: 780, right: 1690 };

describe("H7d the Continue menu clears the Continue line", () => {
  it("with no line, it opens 8 px above the button, right edges aligned (unchanged)", () => {
    expect(menuPlacement(button, null, viewport)).toEqual({
      right: 38,
      bottom: 871 - 780 + 8,
      maxHeight: 871 - 99 - 8,
    });
  });
  it("with the line above the button and under the menu, it opens 8 px above the line", () => {
    const line = { top: 700, bottom: 744, left: 1400, right: 1700 };
    expect(menuPlacement(button, line, viewport).bottom).toBe(871 - 700 + 8);
  });
  it("a line off to the side, or below the button, changes nothing", () => {
    expect(
      menuPlacement(button, { top: 700, bottom: 744, left: 100, right: 400 }, viewport).bottom,
    ).toBe(99);
    expect(
      menuPlacement(button, { top: 800, bottom: 840, left: 1400, right: 1700 }, viewport).bottom,
    ).toBe(99);
  });
  it("never closer than 8 px to the edges; with no room above the line it stays above the button", () => {
    const p = menuPlacement(
      { top: 160, right: 1725 },
      { top: 110, bottom: 150, left: 1500, right: 1720 },
      viewport,
    );
    expect(p.right).toBe(8);
    expect(p.bottom).toBe(871 - 160 + 8);
    expect(871 - p.bottom - p.maxHeight).toBeGreaterThanOrEqual(8);
  });
  it("wiring: the menu reads the line from its own Ask panel and can scroll", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/ContinueInAI.tsx", "utf8");
    expect(src).toContain(
      `closest(".ask-draft")?.querySelector<HTMLElement>('[data-testid="h7-line"]')`,
    );
    expect(src).toContain("w-64 overflow-y-auto");
  });
});
