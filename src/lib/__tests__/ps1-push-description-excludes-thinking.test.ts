import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("PS1 — the push tool never asks the model to reproduce its own thinking", () => {
  const conversation = src.indexOf('name: "push_conversation"');
  const thread = src.indexOf('name: "push_thread"');
  const conversationDef = conversation > -1 ? src.slice(conversation, thread) : "";

  it("excludes thinking in the push_conversation description", () => {
    expect(conversationDef).toContain("are never part of the transcript");
    expect(conversationDef).toContain("visible conversation only");
  });

  it("excludes thinking in the messages field description", () => {
    expect(conversationDef).toContain("never the assistant's own thinking");
  });

  it("excludes thinking in the content field description", () => {
    expect(conversationDef).toContain("Never the assistant's thinking");
  });

  it("still keeps every load-bearing rule that was already there", () => {
    expect(conversationDef).toContain(
      "Never compose new summaries, recaps or section write-ups and send them as attachments.",
    );
    expect(conversationDef).toContain(
      'enum: ["user", "assistant", "tool"]',
    );
  });
});

describe("PS2 — the push description states server behaviour instead of demanding full reproduction", () => {
  const conversation = src.indexOf('name: "push_conversation"');
  const thread = src.indexOf('name: "push_thread"');
  const conversationDef = conversation > -1 ? src.slice(conversation, thread) : "";

  it("drops the absolutist anti-summary register", () => {
    expect(conversationDef).not.toContain("Verbatim is non-negotiable");
    expect(conversationDef).not.toContain("Never summarize the transcript");
  });

  it("says what the person is doing and how big a window to start with", () => {
    expect(conversationDef).toContain(
      "saving their own conversation into their own record",
    );
    expect(conversationDef).toContain("about twenty messages");
  });
});
