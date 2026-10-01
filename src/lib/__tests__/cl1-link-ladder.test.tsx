// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatUrlLink } from "@/components/work/ChatUrlLink";
import { chatLinkLabel, deriveChatUrl, deriveProjectUrl, itemChatLink, itemChatUrl, safeChatUrl } from "@/lib/chat-url";
import { inheritedConversationUrl } from "@/lib/mcp-push-url";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(cleanup);

const V4 = "0f8fad5b-d9cb-469f-a165-70867728950e";
const V5 = "04883dd3-81b8-5032-ab6e-029f37fedaa7";
const PROJECT = "a1b2c3d4-e5f6-4789-9abc-def012345678";

function item(o: Record<string, unknown> = {}): WorkItemRow {
  return { id: "w1", title: "T", type: "ai_thread", source: "mcp:claude", visibility: "unmapped",
    captured_at: "2026-09-01T00:00:00Z", content_ref: null, source_vendor: "claude",
    orig_conversation_id: null, source_meta: null, meta: null, work_item_tasks: [], ...o } as WorkItemRow;
}

describe("CL-1 ladder", () => {
  it("v4 only for derived conversation links", () => {
    expect(deriveChatUrl("claude", V4)).toBe(`https://claude.ai/chat/${V4}`);
    expect(deriveChatUrl("claude", V5)).toBeNull();
  });
  it("project url from a canonical UUID only", () => {
    expect(deriveProjectUrl(PROJECT)).toBe(`https://claude.ai/project/${PROJECT}`);
    expect(deriveProjectUrl("not-a-uuid")).toBeNull();
    expect(deriveProjectUrl(`${PROJECT}/x`)).toBeNull();
    expect(deriveProjectUrl(null)).toBeNull();
  });
  it("safeChatUrl keeps any https host but not front doors, http, credentials or long links", () => {
    expect(safeChatUrl("https://copilot.microsoft.com/chats/abc")).toBe("https://copilot.microsoft.com/chats/abc");
    expect(safeChatUrl("https://claude.ai/")).toBeNull();
    expect(safeChatUrl("http://claude.ai/chat/x")).toBeNull();
    expect(safeChatUrl("javascript:alert(1)")).toBeNull();
    expect(safeChatUrl("data:text/html,x")).toBeNull();
    expect(safeChatUrl("https://u:p@claude.ai/chat/x")).toBeNull();
    expect(safeChatUrl(`https://a.com/${"x".repeat(2100)}`)).toBeNull();
  });
  it("order: pasted, pushed, derived, project", () => {
    const all = { meta: { chat_url: "https://p.example.com/1" }, source_meta: { url: "https://claude.ai/chat/pushed", source_project: { id: PROJECT } }, orig_conversation_id: V4 };
    expect(itemChatLink(item(all))).toEqual({ url: "https://p.example.com/1", kind: "pasted" });
    expect(itemChatLink(item({ ...all, meta: null }))).toEqual({ url: "https://claude.ai/chat/pushed", kind: "conversation" });
    expect(itemChatLink(item({ meta: null, source_meta: { source_project: { id: PROJECT } }, orig_conversation_id: V4 }))).toEqual({ url: `https://claude.ai/chat/${V4}`, kind: "conversation" });
    expect(itemChatLink(item({ source_meta: { url: "https://claude.ai/", source_project: { id: PROJECT } }, orig_conversation_id: V5 }))).toEqual({ url: `https://claude.ai/project/${PROJECT}`, kind: "project" });
    expect(itemChatLink(item())).toBeNull();
    expect(itemChatUrl(item({ source_meta: { source_project: { id: PROJECT } } }))).toBe(`https://claude.ai/project/${PROJECT}`);
  });
  it("labels tell the truth", () => {
    expect(chatLinkLabel({ url: `https://claude.ai/project/${PROJECT}`, kind: "project" })).toBe("Open the project");
    expect(chatLinkLabel({ url: "https://claude.ai/chat/x", kind: "conversation" })).toBe("Open in Claude");
    expect(chatLinkLabel({ url: "https://chatgpt.com/c/x", kind: "pasted" })).toBe("Open in ChatGPT");
    render(<ChatUrlLink item={item({ source_meta: { source_project: { id: PROJECT } } })} showAbsence />);
    const a = screen.getByRole("link", { name: /Open the project/ });
    expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.queryByText(/Open the conversation/)).toBeNull();
  });
  it("an inherited front door is not stored", () => {
    expect(inheritedConversationUrl({ url: "https://claude.ai/" })).toBeNull();
    expect(inheritedConversationUrl({ url: "https://claude.ai/chat/x" })).toBe("https://claude.ai/chat/x");
  });
  it("the probe is gone", () => {
    expect(existsSync("src/lib/__tests__/cl0-transport-probe.test.ts")).toBe(false);
    for (const f of ["src/lib/mcp-handler.server.ts", "src/lib/telemetry-shared.ts", "src/lib/event-dim-allowlist.ts"]) {
      const s = readFileSync(f, "utf8");
      expect(s).not.toMatch(/transport_probe|recordTransportProbe|PROBE_/);
    }
  });
});
