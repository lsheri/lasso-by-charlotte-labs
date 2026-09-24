import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const telemetry = readFileSync("src/lib/telemetry-shared.ts", "utf8");
const functions = readFileSync("src/lib/chat-library.functions.ts", "utf8");

describe("pass 176 — the reader opens on a click", () => {
  it("keeps the pane closed at rest", () => {
    expect(styles).toContain('.nb-chatview[data-reader="open"]');
    expect(styles).toContain("grid-template-columns: minmax(0, 1fr) 0px");
  });

  it("drives the pane from the selection", () => {
    expect(page).toContain('data-reader={selected ? "open" : "closed"}');
    expect(page).toContain('selected && desktopReader ? "h-[calc(100vh-6.5rem)] overflow-y-auto" : "hidden"');
  });

  it("offers a way out", () => {
    expect(page).toContain('aria-label="Close the reader"');
  });

  it("drops the placeholder line", () => {
    expect(page).not.toContain("Pick a conversation to read it here");
  });

  it("keeps both real surfaces", () => {
    expect(page).toContain("<CaptureCoverage");
    expect(page).toContain("WHY THIS PANEL EXISTS");
  });

  it("registers the close event", () => {
    expect(telemetry).toContain('| "chatlib.reader_closed"');
  });

  it("records the close with dims only", () => {
    expect(functions).toContain("chatlib.reader_closed");
    const block = functions.slice(functions.indexOf("chatlib.reader_closed"));
    expect(block).not.toContain("payload:");
  });
});
