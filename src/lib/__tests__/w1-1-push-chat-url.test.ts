import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MISSING_CHAT_URL_NOTE,
  missingChatUrlNote,
  rawPushUrl,
  storedPushChatUrl,
} from "@/lib/mcp-push-url";

const REAL = "https://claude.ai/chat/04883dd3-81b8-5032-ab6e-029f37fedaa7";

describe("W1.1 — one parameter, asked for once", () => {
  it("a push carrying a real conversation URL stores it and the reply says nothing about links", () => {
    const args = { title: "CPT 0511U", chat_url: REAL };
    expect(storedPushChatUrl(args)).toBe(REAL);
    expect(missingChatUrlNote(args)).toBe("");
  });

  it("a push with no URL is still saved, and the reply asks for one", () => {
    const args = { title: "CPT 0511U" };
    expect(storedPushChatUrl(args)).toBeNull();
    expect(missingChatUrlNote(args)).toBe(MISSING_CHAT_URL_NOTE);
    expect(MISSING_CHAT_URL_NOTE).toContain("chat_url");
  });

  it("a push carrying the vendor front door is treated as if no URL came", () => {
    const args = { title: "CPT 0511U", chat_url: "https://claude.ai/" };
    expect(storedPushChatUrl(args)).toBeNull();
    expect(missingChatUrlNote(args)).toBe(MISSING_CHAT_URL_NOTE);
  });

  it("still reads source_url, so a push already written against it keeps working", () => {
    expect(rawPushUrl({ source_url: REAL })).toBe(REAL);
    expect(storedPushChatUrl({ source_url: REAL })).toBe(REAL);
    expect(missingChatUrlNote({ source_url: REAL })).toBe("");
  });

  it("keeps the recognition key even when the host is not one we store", () => {
    // The key that finds the same conversation again is unfiltered, exactly as
    // source_url was, so recognition does not narrow with this change.
    expect(rawPushUrl({ chat_url: "https://intranet.example.com/thread/9" })).toBe(
      "https://intranet.example.com/thread/9",
    );
    expect(storedPushChatUrl({ chat_url: "https://intranet.example.com/thread/9" })).toBeNull();
  });
});

describe("W1.1 — the tool contract", () => {
  const src = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

  it("no longer offers source_url as a parameter", () => {
    expect(src).not.toContain("source_url: {");
  });

  it("stops hedging in the chat_url description", () => {
    expect(src).not.toContain("if you can see it. Stored only for");
    expect(src).toContain("its URL is in the address bar");
  });
});
