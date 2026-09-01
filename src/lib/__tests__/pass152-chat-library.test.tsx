// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { navGroups } from "@/components/layout/nav-config";
import { TOOL_VENDORS, vendorFromSource } from "@/lib/work-taxonomy";
import type { WorkItemRow } from "@/lib/work-types";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";

afterEach(cleanup);

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    title: "A conversation",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: "2026-01-01T00:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "transcribed",
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

describe("chat library — the name", () => {
  it("names the section in the sidebar", () => {
    const labels = navGroups.flatMap((g) => g.items.map((i) => i.label));
    expect(labels).toContain("Chat library");
    expect(labels).not.toContain("AI record");
  });

  it("leaves the route URL alone", () => {
    const item = navGroups.flatMap((g) => g.items).find((i) => i.label === "Chat library");
    expect(item?.to).toBe("/ai-record");
  });

  it("carries no stale name in the page or its route", () => {
    for (const path of ["src/pages/AiRecordPage.tsx", "src/routes/_authenticated/ai-record.tsx"]) {
      const src = readFileSync(path, "utf8");
      expect(src).not.toMatch(/"AI record"|AI record \| Lasso/);
    }
  });

  it("keeps the search input named for chats", () => {
    const src = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
    expect(src).toContain('placeholder="Search your chats"');
  });

  it("keeps the language laws in the page copy", () => {
    const src = readFileSync("src/pages/AiRecordPage.tsx", "utf8");
    // tracking- is a Tailwind letter-spacing class, so copy is read word by word.
    const copy = src.toLowerCase().replace(/tracking-\[[^\]]*\]/g, "");
    for (const banned of ["track", "monitor", "surveillance", "data collection"]) {
      expect(copy).not.toContain(banned);
    }
  });
});

describe("chat library — the original chat link", () => {
  it("renders only when a URL exists on the item", () => {
    const { container } = render(<ChatUrlLink item={item()} />);
    expect(container.innerHTML).toBe("");
  });

  it("names the vendor when a URL is stored", () => {
    render(<ChatUrlLink item={item({ source_meta: { url: "https://chatgpt.com/c/1" } })} />);
    const link = screen.getByRole("link", { name: /Open in ChatGPT/ });
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  });

  it("renders for a derivable conversation id", () => {
    render(<ChatUrlLink item={item({ orig_conversation_id: UUID })} />);
    expect(screen.getByRole("link", { name: /Open in Claude/ })).toBeTruthy();
  });
});

describe("chat library — the event", () => {
  it("is registered and additive", () => {
    const src = readFileSync("src/lib/telemetry-shared.ts", "utf8");
    expect(src).toContain('| "chatlib.source_opened"');
    expect(src).toContain('| "model.used"');
  });

  it("emits a closed-vocabulary vendor for any source", () => {
    for (const source of [
      { source_vendor: "claude" },
      { source_vendor: "wildcat-ai" },
      { source_meta: { url: "https://chatgpt.com/c/1" } },
      {},
    ]) {
      expect(TOOL_VENDORS).toContain(vendorFromSource(source as never));
    }
  });

  it("goes through the stamped recordEvent path", () => {
    const src = readFileSync("src/lib/chat-library.functions.ts", "utf8");
    expect(src).toContain("recordEvent");
    expect(src).toContain("chatlib.source_opened");
    expect(src).toContain("vendorFromSource");
  });
});
