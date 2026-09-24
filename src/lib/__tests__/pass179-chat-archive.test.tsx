import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const page = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
const chatRow = readFileSync("src/components/work/ChatRow.tsx", "utf8");
const telemetry = readFileSync("src/lib/telemetry-shared.ts", "utf8");
const functions = readFileSync("src/lib/chat-library.functions.ts", "utf8");

describe("pass 179: the chat archive groups by month", () => {
  it("groups by month and no longer groups by engagement", () => {
    expect(page).toContain("groupByMonth");
    expect(page).not.toContain("function groupItems");
  });

  it("offers the engagement filter row", () => {
    expect(page).toContain('aria-label="Filter by engagement"');
  });

  it("keeps What recurs, the only engagement scoped analysis", () => {
    expect(page).toContain("AnalysisChips");
    expect(page).toContain("InlineAnalysisBlocks");
  });

  it("reads All conversations in the heading", () => {
    expect(page).toContain('>All conversations</h1>');
  });

  it("colours the engagement code on the row", () => {
    expect(chatRow).toContain("engagementHue");
  });

  it("registers the filter event", () => {
    expect(telemetry).toContain('| "chatlib.filter_changed"');
  });

  it("records the filter event with closed vocabulary only", () => {
    expect(functions).toContain("chatlib.filter_changed");
    const fn = functions.slice(functions.indexOf("noteFilterChangedFn"));
    expect(fn).not.toContain("engagement_id");
    expect(fn).not.toContain("code");
    expect(fn).not.toContain("payload");
  });
});
