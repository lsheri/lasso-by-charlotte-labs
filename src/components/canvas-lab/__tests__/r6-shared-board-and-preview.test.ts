import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { fitWorkboardViewport } from "@/components/canvas-lab/canvas-lab-model";

const SHARED_VIEW = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
const SHARE_DIALOG = readFileSync("src/components/canvas-lab/ShareDialog.tsx", "utf8");
const LINK_SECTION = readFileSync("src/components/canvas-lab/ShareBoardDialog.tsx", "utf8");
const STYLES = readFileSync("src/styles.css", "utf8");

describe("R6 shared board opening", () => {
  it("uses the owner board fit calculation and keeps negative content inside the padded viewport", () => {
    const fitted = fitWorkboardViewport(
      { width: 1000, height: 700 },
      [],
      [
        { id: "left", x: -240, y: -100, width: 280, height: 220 },
        { id: "right", x: 680, y: 420, width: 280, height: 220 },
      ],
      new Map(),
      null,
    );
    const left = fitted.bounds.x * fitted.zoom + fitted.pan.x;
    const top = fitted.bounds.y * fitted.zoom + fitted.pan.y;
    const right = (fitted.bounds.x + fitted.bounds.width) * fitted.zoom + fitted.pan.x;
    const bottom = (fitted.bounds.y + fitted.bounds.height) * fitted.zoom + fitted.pan.y;

    expect(left).toBeGreaterThanOrEqual(32);
    expect(top).toBeGreaterThanOrEqual(32);
    expect(right).toBeLessThanOrEqual(968.001);
    expect(bottom).toBeLessThanOrEqual(668.001);
    expect(SHARED_VIEW).toContain("fitWorkboardViewport");
    expect(SHARED_VIEW).toContain("ResizeObserver");
  });
});

describe("R6 share dialog contrast", () => {
  it("keeps required explanatory copy off the lowest contrast token", () => {
    const readableBlocks = [
      SHARE_DIALOG.slice(SHARE_DIALOG.indexOf("ACCESS_CHOICES.map"), SHARE_DIALOG.indexOf("{problem ?")),
      SHARE_DIALOG.slice(SHARE_DIALOG.indexOf("Already on this board"), SHARE_DIALOG.indexOf("</section>", SHARE_DIALOG.indexOf("Already on this board"))),
      LINK_SECTION.slice(LINK_SECTION.indexOf("shareExposureSentence"), LINK_SECTION.indexOf("{freshUrl ?")),
      LINK_SECTION.slice(LINK_SECTION.indexOf("Live links"), LINK_SECTION.indexOf("</section>")),
    ];
    for (const block of readableBlocks) {
      expect(block).not.toContain("text-soft");
    }
    expect(readableBlocks.join("\n")).toContain("text-foreground");
    expect(readableBlocks.join("\n")).toContain("text-muted-foreground");
  });
});

describe("R6 conversation preview growth", () => {
  it("uses 112px as a minimum, fills available height, and has no fade", () => {
    const body = STYLES.slice(STYLES.indexOf(".chat-preview-window__body {"), STYLES.indexOf(".nb-preview-content {"));
    expect(body).toContain("min-height: var(--nb-chat-preview-height)");
    expect(body).not.toMatch(/\n\s*height:\s*var\(--nb-chat-preview-height\)/);
    expect(body).toContain("flex: 1 1 auto");
    expect(body).not.toContain("mask-image");
    expect(STYLES).toContain("--nb-chat-preview-height: 112px");
  });

  it("leaves the established paper, vendor, and preview-shape rules in place", () => {
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"claude\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"chatgpt\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"gemini\"]");
    expect(STYLES).toContain(".chat-preview-window[data-chat-border=\"copilot\"]");
    expect(STYLES).toContain("aspect-ratio: 3 / 4");
    expect(STYLES).toContain("aspect-ratio: 16 / 9");
    expect(STYLES).toContain("var(--nb-paper-shadow-contact)");
    expect(STYLES).toContain("var(--nb-paper-shadow-ambient)");
  });
});