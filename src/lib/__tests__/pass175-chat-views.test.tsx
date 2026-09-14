import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
const telemetry = readFileSync("src/lib/telemetry-shared.ts", "utf8");
const functions = readFileSync("src/lib/chat-library.functions.ts", "utf8");
const styles = readFileSync("src/styles.css", "utf8");
const chatRow = readFileSync("src/components/work/ChatRow.tsx", "utf8");

describe("pass 175 — cards and list", () => {
  it("defaults the chat library to cards", () => {
    expect(page).toContain('useState<"cards" | "list">("cards")');
  });

  it("uses the shared note rather than a local card", () => {
    expect(page).toContain('import { WorkNote } from "@/components/work/WorkNote"');
    expect(page).not.toMatch(/function\s+Chat(Card|Note)\b/);
  });

  it("registers the view event", () => {
    expect(telemetry).toContain('| "chatlib.view_changed"');
  });

  it("records the view with dims only", () => {
    expect(functions).toContain("chatlib.view_changed");
    const block = functions.slice(functions.indexOf("chatlib.view_changed"));
    expect(block).not.toContain("payload:");
  });

  it("has the wave, and stills it on request", () => {
    expect(styles).toContain("nb-sticky-wave");
    const reduced = styles.slice(styles.indexOf(".nb-sticky-wave"));
    expect(reduced).toMatch(/prefers-reduced-motion: reduce[\s\S]*\.nb-sticky-wave[\s\S]*animation: none/);
  });

  it("shares one fed wording", () => {
    expect(chatRow).toContain("export function fedPhrase");
  });
});
