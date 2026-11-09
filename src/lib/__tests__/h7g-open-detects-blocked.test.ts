// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openInNewTab } from "@/lib/open-tab";

afterEach(() => vi.restoreAllMocks());

describe("H7g: an opened tab reads as opened", () => {
  it("returns true when a tab opens, and cuts its opener link", () => {
    const win = { opener: {} } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(win);
    expect(openInNewTab("https://claude.ai/new?q=hi")).toBe(true);
    expect(open).toHaveBeenCalledWith("https://claude.ai/new?q=hi", "_blank");
    expect((win as unknown as { opener: unknown }).opener).toBeNull();
  });
  it("returns false only when the browser blocks it", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    expect(openInNewTab("https://claude.ai/new")).toBe(false);
  });
  it("the hand-off and the old Continue button both use it; neither reads a noopener window", () => {
    const h7 = readFileSync("src/components/canvas-lab/ask-draft/ContinueInAI.tsx", "utf8");
    const draft = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(h7).toContain("const opened = openInNewTab(url);");
    expect(h7).toContain("return { route, blocked: !opened };");
    expect(draft).toContain("const opened = openInNewTab(handoffUrl(dest));");
    expect(h7 + draft).not.toMatch(/window\.open\([^)]*"noopener"\)/);
  });
});
