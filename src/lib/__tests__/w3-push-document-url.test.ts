import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { inheritedConversationUrl } from "@/lib/mcp-push-url";

const REAL = "https://claude.ai/chat/04883dd3-81b8-5032-ab6e-029f37fedaa7";

const SRC = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
const PUSH_DOCUMENT = SRC.slice(
  SRC.indexOf("async function pushDocument"),
  SRC.indexOf("async function workspaceTypeOf"),
);

describe("W3 — a document inherits its conversation's link", () => {
  it("a document pushed from a conversation that kept a URL inherits it", () => {
    expect(inheritedConversationUrl({ url: REAL, vendor: "claude" })).toBe(REAL);
  });

  it("a document pushed from a conversation with no usable URL inherits nothing", () => {
    expect(inheritedConversationUrl({ vendor: "claude" })).toBeNull();
    expect(inheritedConversationUrl({ url: "" })).toBeNull();
    expect(inheritedConversationUrl(null)).toBeNull();
  });

  it("never derives a URL from the document itself", () => {
    // The helper is handed only the conversation's source_meta. An id and a
    // filename on it change nothing: no stored conversation URL, no link.
    expect(
      inheritedConversationUrl({ id: "conv-123", filename: "notes.md", url: undefined }),
    ).toBeNull();
  });

  it("the handler looks the conversation up by orig_conversation_id and copies its stored link", () => {
    expect(PUSH_DOCUMENT).toContain('args["orig_conversation_id"]');
    expect(PUSH_DOCUMENT).toContain('eq("type", "ai_thread")');
    expect(PUSH_DOCUMENT).toContain('eq("orig_conversation_id", origId)');
    expect(PUSH_DOCUMENT).toContain("inheritedConversationUrl(thread?.source_meta ?? null)");
    expect(PUSH_DOCUMENT).toMatch(/\.\.\.\(inheritedUrl \? \{ url: inheritedUrl \}/);
  });

  it("a standalone document gets no link and no message about one", () => {
    // The ask-for-a-link note belongs to conversations only. pushDocument's
    // body and its reply never mention it, whether or not a URL came through.
    expect(PUSH_DOCUMENT).not.toContain("missingChatUrlNote");
    expect(PUSH_DOCUMENT).not.toContain("MISSING_CHAT_URL_NOTE");
  });

  it("push_document offers orig_conversation_id and no URL field of its own", () => {
    const schema = SRC.slice(
      SRC.indexOf('name: "push_document"'),
      SRC.indexOf('required: ["title", "filename", "content"]'),
    );
    expect(schema).toContain("orig_conversation_id");
    expect(schema).not.toContain("chat_url");
    // Still exactly two URL parameters in the whole contract, both on the
    // conversation tools.
    expect(SRC.match(/chat_url: CHAT_URL_FIELD/g) ?? []).toHaveLength(2);
  });
});
