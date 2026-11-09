import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const peek = readFileSync("src/components/peek/PeekPanel.tsx", "utf8");

describe("GRANOLA-1b: calls show their version history", () => {
  it("the reader shows version history for calls as well as deliverables", () => {
    expect(peek).toMatch(/\{isDeliverableType\(active\.type\) \|\| active\.type === "call" \? \(/);
  });
  it("what fed this stays for deliverables only", () => {
    expect(peek).toMatch(/\{isDeliverableType\(active\.type\) \? <WhatFedThis /);
  });
  it("a re-import reads in plain words", () => {
    expect(readFileSync("src/components/peek/VersionHistory.tsx", "utf8")).toContain('connector_reimport: "re-imported from the source"');
  });
});
