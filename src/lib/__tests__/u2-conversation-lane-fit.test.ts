import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("All AI Conversations month flow", () => {
  const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");

  it("uses document flow instead of a scaled board", () => {
    expect(page).toContain('aria-label="AI conversations by month"');
    expect(page).not.toContain("showViewControls");
    expect(styles).toContain(".conversation-month-stack");
  });

  it("wraps content-sized SketchCards into additional rows", () => {
    expect(styles).toContain("repeat(auto-fill");
    expect(styles).toContain("230.5px");
    expect(page).not.toContain("h-[118px]");
    expect(page).toContain("import { SketchCard } from '@/design/reference/SketchCard';");
    expect(page).toContain('<div data-lane-content className="h-full min-w-0">');
    expect(page).not.toMatch(/<div\b[^>]*\bdata-lane-content\b[^>]*\bstyle\s*=/);
  });
});