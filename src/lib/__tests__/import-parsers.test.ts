import { describe, expect, it } from "vitest";

import { parseImport } from "@/lib/import-parsers";

describe("import parsers", () => {
  it("reconstructs a ChatGPT thread", () => {
    const convo = {
      title: "Coalition pricing",
      create_time: 1_700_000_000,
      mapping: {
        root: { id: "root", message: null, parent: null, children: ["a"] },
        a: {
          id: "a",
          parent: "root",
          children: ["b"],
          message: {
            author: { role: "user" },
            create_time: 1_700_000_001,
            content: { parts: ["What should we price?"] },
          },
        },
        b: {
          id: "b",
          parent: "a",
          children: [],
          message: {
            author: { role: "assistant" },
            create_time: 1_700_000_002,
            content: { parts: ["Start at cost plus 20%."] },
          },
        },
      },
    };
    const out = parseImport("chatgpt", [
      { name: "conversations.json", text: JSON.stringify([convo]) },
    ]);
    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0]?.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
    expect(out.conversations[0]?.turns[1]?.content).toContain("cost plus");
  });

  it("maps Claude human turns to user", () => {
    const convo = {
      uuid: "c-1",
      name: "Untitled",
      created_at: "2026-01-02T03:04:05Z",
      chat_messages: [
        { sender: "human", text: "Draft the memo", created_at: "2026-01-02T03:04:05Z" },
        { sender: "assistant", text: "Here is a draft.", created_at: "2026-01-02T03:05:05Z" },
      ],
    };
    const out = parseImport("claude", [
      { name: "conversations.json", text: JSON.stringify([convo]) },
    ]);
    expect(out.conversations).toHaveLength(1);
    expect(out.conversations[0]?.turns.map((t) => t.role)).toEqual(["user", "assistant"]);
  });

  it("never throws on malformed records", () => {
    const out = parseImport("chatgpt", [{ name: "conversations.json", text: "[{\"nope\":1}]" }]);
    expect(out.conversations).toHaveLength(0);
  });
});
