// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { anchorElement, onAnotherPage, pagedHost, showPage } from "@/lib/sticky-anchors";

function pdf(shown: number, count: number) {
  const root = document.createElement("div");
  root.innerHTML = `<div data-anchor-pages="${count}"><canvas data-anchor-page="${shown}"></canvas></div>`;
  return root;
}

describe("S2c stickies on a paged file (a PDF deck shows one page at a time)", () => {
  it("the shown page is a spot; another page in the file is not gone, just not shown", () => {
    const root = pdf(1, 9);
    expect(anchorElement(root, { kind: "page", pageNo: 1 })?.tagName).toBe("CANVAS");
    expect(anchorElement(root, { kind: "page", pageNo: 3 })).toBeNull();
    expect(onAnotherPage(root, { kind: "page", pageNo: 3 })).toBe(true);
    expect(onAnotherPage(root, { kind: "page", pageNo: 1 })).toBe(false);
  });
  it("a page past the end of the file is gone, and so is any non-page spot that is missing", () => {
    const root = pdf(1, 9);
    expect(onAnotherPage(root, { kind: "page", pageNo: 12 })).toBe(false);
    expect(onAnotherPage(root, { kind: "row", rowKey: "2" })).toBe(false);
  });
  it("asking for a page tells the file to turn to it", () => {
    const root = pdf(1, 9);
    const host = pagedHost(root)!;
    const heard = vi.fn();
    host.el.addEventListener("lasso-go-page", (event) =>
      heard((event as CustomEvent<number>).detail),
    );
    expect(showPage(root, 4)).toBe(true);
    expect(heard).toHaveBeenCalledWith(4);
    expect(showPage(root, 40)).toBe(false);
  });
  it("a file that is not paged has no host", () => {
    const root = document.createElement("div");
    expect(pagedHost(root)).toBeNull();
    expect(showPage(root, 2)).toBe(false);
  });
  it("the PDF viewer marks its page and its page count, and turns on request", () => {
    const src = readFileSync("src/components/canvas-lab/WorkboardFilePreview.tsx", "utf8");
    expect(src).toContain("data-anchor-page={pageNumber}");
    expect(src).toContain("data-anchor-pages={pageCount || undefined}");
    expect(src).toContain('el.addEventListener("lasso-go-page", go);');
  });
  it("the Stickies tab lists stickies on other pages, opens their page, and re-measures when the page turns", () => {
    const panel = readFileSync("src/components/canvas-lab/LiftedStickies.tsx", "utf8");
    const hook = readFileSync("src/components/canvas-lab/useLiftedStickies.tsx", "utf8");
    expect(panel).toContain("onAnotherPage(content, sticky.anchor)");
    expect(panel).toContain('attributeFilter: ["data-anchor-page"]');
    expect(hook).toContain("showPage(content, sticky.anchor.pageNo)");
  });
});
