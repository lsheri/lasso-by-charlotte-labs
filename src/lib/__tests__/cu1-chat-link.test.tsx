// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ChatLinkDialog, CHAT_LINK_COPY } from "@/components/canvas-lab/ChatLinkDialog";
import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { itemChatUrl, pastedChatUrl, safeChatUrl } from "@/lib/chat-url";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(cleanup);

const PASTED = "https://www.perplexity.ai/search/abc-123";
const PUSHED = "https://claude.ai/chat/04883dd3-81b8-5032-ab6e-029f37fedaa7";

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1", title: "Thread", type: "ai_thread", source: "mcp:chatgpt", visibility: "unmapped",
    captured_at: "2026-09-01T00:00:00Z", content_ref: null, source_vendor: "chatgpt",
    orig_conversation_id: "slug-not-uuid", source_meta: null, meta: null, work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

describe("CU1 validation", () => {
  it("accepts any https link, with no host list", () => {
    expect(pastedChatUrl(PASTED)).toBe(PASTED);
    expect(pastedChatUrl("  https://copilot.microsoft.com/chats/x  ")).toBe("https://copilot.microsoft.com/chats/x");
  });
  it("refuses http, javascript:, data:, credentials and junk", () => {
    for (const bad of ["http://example.com/c/1", "javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,<b>x</b>", "https://u:p@example.com/x", "not a url", "", `https://a.com/${"x".repeat(2100)}`, 42]) {
      expect(pastedChatUrl(bad)).toBeNull();
    }
  });
  it("leaves safeChatUrl unchanged for its callers", () => {
    expect(safeChatUrl(PASTED)).toBeNull();
    expect(safeChatUrl(PUSHED)).toBe(PUSHED);
  });
});

describe("CU1 precedence: pasted, then pushed, then derived", () => {
  it("a pasted link wins over a pushed one", () => {
    expect(itemChatUrl(item({ meta: { chat_url: PASTED }, source_meta: { url: PUSHED } as never }))).toBe(PASTED);
  });
  it("a pushed link still renders when nothing was pasted", () => {
    expect(itemChatUrl(item({ source_meta: { url: PUSHED } as never }))).toBe(PUSHED);
  });
  it("an invalid pasted value falls back to the pushed link", () => {
    expect(itemChatUrl(item({ meta: { chat_url: "javascript:alert(1)" }, source_meta: { url: PUSHED } as never }))).toBe(PUSHED);
  });
});

describe("CU1 rendering", () => {
  it("no link renders no anchor", () => {
    render(<ChatUrlLink item={item()} showAbsence />);
    expect(screen.queryByRole("link")).toBeNull();
  });
  it("a pasted https link renders a safe anchor pointing at it", () => {
    render(<ChatUrlLink item={item({ meta: { chat_url: PASTED } })} showAbsence />);
    const a = screen.getByRole("link") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe(PASTED);
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
  });
  it("a javascript: link is never rendered as an anchor", () => {
    const { container } = render(<ChatUrlLink item={item({ meta: { chat_url: "javascript:alert(1)" } })} showAbsence />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(container.innerHTML).not.toContain("javascript:");
  });
});

describe("CU1 the paste dialog", () => {
  it("refuses a javascript: link and never saves it", async () => {
    const onSave = vi.fn(async () => {});
    render(<ChatLinkDialog open onOpenChange={() => {}} current={null} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(CHAT_LINK_COPY.label), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: CHAT_LINK_COPY.save }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
  });
  it("saves a valid https link", async () => {
    const onSave = vi.fn(async () => {});
    render(<ChatLinkDialog open onOpenChange={() => {}} current={null} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText(CHAT_LINK_COPY.label), { target: { value: PASTED } });
    fireEvent.click(screen.getByRole("button", { name: CHAT_LINK_COPY.save }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(PASTED));
  });
});

describe("CU1 wiring", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const shared = readFileSync("src/components/canvas-lab/SharedBoardView.tsx", "utf8");
  const demo = readFileSync("src/components/demo/DemoWorkboardSandbox.tsx", "utf8");
  const example = readFileSync("src/components/canvas-lab/ExampleBoardOverlay.tsx", "utf8");
  const save = readFileSync("src/lib/work-chat-link.ts", "utf8");
  const push = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

  it("only the live board can offer the paste control, and only to the owner", () => {
    expect(page).toContain("onSaveChatLink={cardItem && ownsWorkItem(profile, cardItem) ? (url) => saveChatLink(cardItem.id, url) : undefined}");
    for (const src of [shared, demo, example]) expect(src).not.toContain("onSaveChatLink");
  });
  it("no event carries the link", () => {
    expect(save).not.toMatch(/recordEvent|note[A-Z]\w*\(|posthog/i);
    const fn = page.slice(page.indexOf("async function saveChatLink"), page.indexOf("const itemByNode"));
    expect(fn).not.toMatch(/note[A-Z]\w*\(|recordEvent/);
  });
  it("copy has no em dash", () => {
    for (const value of Object.values(CHAT_LINK_COPY)) expect(value).not.toContain("\u2014");
  });
  it("a re-pushed attachment keeps its prior meta", () => {
    expect(push).toContain("parent_work_item_id, content_fidelity, meta\")");
    expect(push).toMatch(/duplicate_of_transcript: false,\s*\} as unknown as Json,[\s\S]{0,160}meta: \{\s*\.\.\.\(match\?\.meta && typeof match\.meta === "object"[\s\S]{0,140}assistant_transcribed: true/);
    // The first-time thread insert is untouched.
    expect(push).toMatch(/source_project: plan\.sourceProject \} : \{\}\),\s*\} as unknown as Json,\s*meta: \{ assistant_transcribed: true \},/);
  });
});
