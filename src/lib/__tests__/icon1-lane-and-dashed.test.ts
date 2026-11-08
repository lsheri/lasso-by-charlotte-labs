// ICON-1: the two draw tools look different. Workstream = lane holding cards; section = dashed area with a title line.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const icons = readFileSync(resolve(process.cwd(), "src/components/notebook/icons.tsx"), "utf8");
const page = readFileSync(resolve(process.cwd(), "src/pages/CanvasLabPage.tsx"), "utf8");
const line = (key: string) => icons.split("\n").find((l) => l.trimStart().startsWith(key)) ?? "";

describe("ICON-1 Lane and Dashed area", () => {
  it("draws the workstream tool as a lane: column, header line, two cards", () => {
    const dw = line('"draw-workstream": {');
    expect(dw).toContain("M4.6 6.6h10.8");
    expect(dw).toContain("M7.6 10h4.8M7.6 13.4h4.8");
  });

  it("draws the section tool as a dashed area with a title line and no tab", () => {
    const sec = line("section: {");
    expect(sec).toContain("M5.6 7.8h3.6");
    expect(sec).not.toContain("M3.6 2.9h4.3v2.3H3.6z");
  });

  it("keeps the toolbar names and says what each one does", () => {
    expect(page).toContain('label="Draw a workstream. Work inside counts as one piece."');
    expect(page).toContain('label="Draw a section. Just an area. Nothing inside is joined."');
    expect(page).toMatch(/aria-label="Draw a workstream"[\s\S]*?<GraphiteIcon name="draw-workstream"/);
  });
});
