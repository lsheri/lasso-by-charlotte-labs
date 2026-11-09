import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/styles.css", "utf8");
const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
const sticky = readFileSync("src/components/canvas-lab/LabSticky.tsx", "utf8");

describe("LEG-1: workstream and grouping names read like section titles", () => {
  const rule = css.slice(css.indexOf(".canvas-lab-frame > [data-frame-name] h2,"), css.indexOf(".canvas-lab-frame > [data-frame-name] > div"));
  it("same size, weight, face and zoom scaling as the section title", () => {
    const section = css.slice(css.indexOf(".canvas-lab-section-title { position: absolute;"), css.indexOf(".canvas-lab-section-title:hover"));
    for (const part of ["font-size: 34px", "font-weight: 700", "font-family: var(--font-serif)", "transform: scale(var(--lab-section-label-inverse-zoom, 1))"]) {
      expect(section).toContain(part);
      expect(rule).toContain(part);
    }
  });
  it("sits on the frame's top edge on a knock-out; the count stays inside", () => {
    expect(css).toContain(".canvas-lab-frame > [data-frame-name] { position: absolute; top: -20px; left: 14px; right: 12px; align-items: flex-start; pointer-events: none; }");
    expect(rule).toContain("background: var(--lab-section-title-fill, var(--nb-paper))");
    expect(css).toContain(".canvas-lab-frame > [data-frame-name] > span:last-child { position: absolute; top: 30px; right: 0; }");
  });
});

describe("LEG-1: new stickies start at 26 px", () => {
  it("a new sticky is Heading (26 px, twice Body); saved stickies keep their stored size", () => {
    expect(page).toMatch(/kind: "sticky", frame: null, title: "Sticky", summary: text \?\? "", typeLabel: "sticky",\s*\/\/ LEG-1[^\n]*\n\s*ownership: "yours", textSize: "heading"/);
    expect(sticky).toContain('.canvas-lab-sticky[data-size="heading"] .node-rich .rich-text { font-size: 26px; }');
    expect(sticky).toContain('.canvas-lab-sticky[data-size="body"] .node-rich .rich-text { font-size: 13px; }');
  });
});

describe("LEG-1b: nothing on the element outranks the label rules", () => {
  const frame = readFileSync("src/components/canvas-lab/LabFrame.tsx", "utf8");
  it("the name strip, the name and the rename box carry no size, colour or position utilities", () => {
    expect(frame).toContain('<div data-frame-name="" className="canvas-lab-frame-label flex items-baseline justify-between gap-2">');
    expect(frame).toMatch(/<h2\s+className="canvas-lab-frame-title"/);
    expect(frame).toContain('className="canvas-lab-frame-name-input canvas-lab-frame-title"');
    expect(frame).not.toMatch(/font-hand text-\[18px\]/);
  });
});
