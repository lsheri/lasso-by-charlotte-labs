// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { BRANCH_TARGETS, BRANCH_URL_LIMIT, CHATGPT_URL_LIMIT, CLAUDE_URL_LIMIT, branchOpenPlan } from "@/lib/branch-targets";
import { handoffRoute, packageHandoff } from "@/lib/ask-handoff";
import { H7_COPY, hintMs } from "@/components/canvas-lab/ask-draft/ContinueInAI";

// A chat the size Liam sends: three answers of about 1,500 characters each.
const answer = "The pricing work so far points at a per-seat model with a floor for small firms. ".repeat(18);
const chat = packageHandoff({
  choice: "chat_and_used",
  boardTitle: "Artemis",
  messages: [
    { role: "user", content: "What did Ben say about pricing?" },
    { role: "assistant", content: answer },
    { role: "user", content: "Draft the next steps." },
    { role: "assistant", content: answer },
    { role: "user", content: "Compare with Roger's notes." },
    { role: "assistant", content: answer },
  ],
  used: [{ title: "Liam x Ben - Sales Analysis", kind: "call" }],
  board: [],
  viaConnector: false,
});

describe("H7f: Continue in Claude carries the chat", () => {
  it("a real-sized chat is far past the old 1,800 guard, and now goes by link", () => {
    expect(`${BRANCH_TARGETS.claude.prefix}${encodeURIComponent(chat)}`.length).toBeGreaterThan(BRANCH_URL_LIMIT);
    const route = handoffRoute("claude", chat, false);
    expect(route.route).toBe("link");
    expect(decodeURIComponent(route.url.slice(BRANCH_TARGETS.claude.prefix.length))).toBe(chat);
  });
  it("the Claude ceiling sits under the 32,000 characters measured live", () => {
    expect(CLAUDE_URL_LIMIT).toBe(30_000);
    expect(BRANCH_TARGETS.claude.urlLimit).toBe(CLAUDE_URL_LIMIT);
  });
  it("ChatGPT is measured (H7h); Gemini keeps the old guard", () => {
    expect(BRANCH_TARGETS.chatgpt.urlLimit).toBe(CHATGPT_URL_LIMIT);
    expect(BRANCH_TARGETS.gemini.urlLimit).toBe(BRANCH_URL_LIMIT);
    expect(branchOpenPlan("chatgpt", chat).handoff).toBe("link");
    expect(branchOpenPlan("chatgpt", "x".repeat(CHATGPT_URL_LIMIT)).handoff).toBe("clipboard");
    expect(branchOpenPlan("gemini", "hi").handoff).toBe("clipboard");
  });
  it("past the ceiling the clipboard hint says what to do and stays long enough to read", () => {
    expect(H7_COPY.hint.clipboard("Claude")).toBe("Too long for a link, so it is copied. In Claude, paste it into the new chat and send.");
    expect(hintMs("clipboard")).toBe(8000);
    expect(hintMs("file")).toBe(8000);
    expect(hintMs("blocked")).toBe(8000);
    expect(hintMs("link")).toBe(2500);
  });
  it("the hint timer uses hintMs; flag-off hand-off is unchanged", () => {
    const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
    expect(src).toMatch(/setTimeout\(\(\) => setHandoffHint\(null\), hintMs\(blocked \? "blocked" : route\)\)/);
    expect(src).toMatch(/"Prompt copied\. Paste it there to carry on\."/);
  });
  it("no em dashes in the copy", () => {
    expect(Object.values(H7_COPY.hint).map((h) => (typeof h === "string" ? h : h("Claude"))).join(" ")).not.toMatch(/—/);
  });
});
