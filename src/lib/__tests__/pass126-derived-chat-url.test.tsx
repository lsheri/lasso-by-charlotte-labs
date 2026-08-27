// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { deriveChatUrl, effectiveChatUrl } from "@/lib/chat-url";
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

describe("pass 126 — deriveChatUrl", () => {
  it("derives the vendor URL from a real conversation UUID", () => {
    expect(deriveChatUrl("claude", UUID)).toBe(`https://claude.ai/chat/${UUID}`);
    expect(deriveChatUrl("chatgpt", UUID)).toBe(`https://chatgpt.com/c/${UUID}`);
  });

  it("accepts an uppercase UUID", () => {
    expect(deriveChatUrl("claude", UUID.toUpperCase())).toBe(
      `https://claude.ai/chat/${UUID.toUpperCase()}`,
    );
  });

  it("refuses minted, prefixed or decorated ids", () => {
    expect(deriveChatUrl("claude", "charlotte-pricing-model-artemis-aug-2026")).toBeNull();
    expect(deriveChatUrl("claude", "session_016BPWabcdefghijklmnop")).toBeNull();
    expect(deriveChatUrl("claude", `${UUID}/../../evil`)).toBeNull();
    expect(deriveChatUrl("chatgpt", `${UUID}?x=1`)).toBeNull();
    expect(deriveChatUrl("claude", null)).toBeNull();
  });

  it("does not derive for vendors whose URLs are not id-deterministic", () => {
    expect(deriveChatUrl("gemini", UUID)).toBeNull();
    expect(deriveChatUrl("copilot", UUID)).toBeNull();
    expect(deriveChatUrl(null, UUID)).toBeNull();
  });
});

describe("pass 126 — effectiveChatUrl", () => {
  it("prefers an explicit valid URL", () => {
    expect(effectiveChatUrl("https://claude.ai/chat/explicit", "claude", UUID)).toBe(
      "https://claude.ai/chat/explicit",
    );
  });

  it("falls through to derivation when the explicit URL is unsafe", () => {
    expect(effectiveChatUrl("http://claude.ai/chat/x", "claude", UUID)).toBe(
      `https://claude.ai/chat/${UUID}`,
    );
    expect(effectiveChatUrl("https://evil.example.com/x", "claude", UUID)).toBe(
      `https://claude.ai/chat/${UUID}`,
    );
  });

  it("returns null when neither source yields a link", () => {
    expect(effectiveChatUrl(null, "claude", "minted-slug")).toBeNull();
  });
});

describe("pass 126 — the link renders where it already rendered", () => {
  it("shows the affordance for a real-UUID conversation with no explicit URL", () => {
    render(<ChatUrlLink item={item({ orig_conversation_id: UUID })} />);
    expect(screen.getByRole("link", { name: /Open in Claude/ })).toBeTruthy();
  });

  it("renders nothing for a model-minted id", () => {
    const { container } = render(
      <ChatUrlLink item={item({ orig_conversation_id: "charlotte-pricing-model-artemis-aug-2026" })} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
