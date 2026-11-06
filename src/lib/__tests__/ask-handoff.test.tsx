// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { HANDOFF_VENDORS, handoffPrompt, handoffUrl, readHandoffDestination, shouldNudge, writeHandoffDestination } from "@/lib/ask-handoff";
import { MCP_PUSH_PHRASE } from "@/lib/mcp-setup-steps";

beforeEach(() => localStorage.clear());
describe("HAND-1 handoff", () => {
  it("defaults to Claude with no URL", () => {
    expect(readHandoffDestination("board", localStorage)).toEqual({ vendor: "claude" });
  });
  it("drops a ChatGPT URL saved for Claude", () => {
    localStorage.setItem("lasso.ask-handoff.board", JSON.stringify({ vendor: "claude", url: "https://chatgpt.com/project/123" }));
    expect(readHandoffDestination("board", localStorage)).toEqual({ vendor: "claude" });
  });
  it("round-trips a Claude project URL", () => {
    const dest = { vendor: "claude" as const, url: "https://claude.ai/project/123" };
    writeHandoffDestination("board", dest, localStorage);
    expect(readHandoffDestination("board", localStorage)).toEqual(dest);
  });
  it("rejects HTTP and lookalike hosts", () => {
    for (const url of ["http://claude.ai/project/123", "https://evilclaude.ai/project/123"]) {
      writeHandoffDestination("board", { vendor: "claude", url }, localStorage);
      expect(readHandoffDestination("board", localStorage).url).toBeUndefined();
    }
  });
  it("uses the vendor new-chat URL when absent", () => {
    for (const vendor of HANDOFF_VENDORS) expect(handoffUrl({ vendor: vendor.id })).toBe(vendor.newChat);
  });
  it("includes title, roles and the push phrase last", () => {
    expect(handoffPrompt({ boardTitle: "Acme", messages: [{ role: "user", content: "Question" }, { role: "assistant", content: "Answer" }] })).toBe(`I was working on the Lasso board "Acme". Here is the conversation so far. Carry it on from here.\n\nYou: Question\n\nLasso: Answer\n\nWhen we are done, say: ${MCP_PUSH_PHRASE}`);
  });
  it("keeps only the last 12 messages with the omitted-turns marker", () => {
    const prompt = handoffPrompt({ boardTitle: "Acme", messages: Array.from({ length: 13 }, (_, i) => ({ role: "assistant", content: `turn-${i}-end` })) });
    expect(prompt).toContain("\n\n(earlier turns left out)\n");
    expect(prompt).not.toContain("turn-0-end");
    expect(prompt).toContain("turn-12-end");
  });
  it("caps the full prompt at 6000 characters", () => {
    const prompt = handoffPrompt({ boardTitle: "Acme", messages: [{ role: "assistant", content: "x".repeat(7000) }] });
    expect(prompt.length).toBe(6000);
    expect(prompt).toContain("(earlier turns left out)");
    expect(prompt.endsWith(MCP_PUSH_PHRASE)).toBe(true);
  });
  it.each([[6, null, true], [12, null, true], [5, null, false], [0, null, false], [6, 6, false], [12, 6, true]] as const)("nudges at %s after %s: %s", (turns, dismissed, expected) => {
    expect(shouldNudge(turns, dismissed)).toBe(expected);
  });
});