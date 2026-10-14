import { describe, expect, it } from "vitest";

import { BRANCH_COPY, branchMarkdown, branchOwnerLabel, branchPrompt } from "@/lib/branch-handoff";
import { BRANCH_URL_LIMIT, branchOpenPlan } from "@/lib/branch-targets";

const ID = "7f1c2b9e-1111-4222-8333-944455556666";

describe("branchPrompt", () => {
  const text = branchPrompt(ID);
  it("is short and carries the branch id", () => {
    expect(text.length).toBeLessThan(300);
    expect(text).toContain(ID);
  });
  it("carries no role or style instruction", () => {
    for (const word of ["you are", "act as", "style", "tone", "format"]) expect(text.toLowerCase()).not.toContain(word);
  });
});

describe("branchMarkdown", () => {
  const doc = branchMarkdown({
    branchId: ID,
    sourceId: "src-1",
    sourceTitle: "Pricing memo",
    sourceOwner: "Dana",
    tool: "claude",
    createdAt: "2026-10-14T02:50:00Z",
    turns: [
      { id: "t-2", turn_no: 2, role: "assistant", content: "Margins fell 4%." },
      { id: "t-1", turn_no: 1, role: "user", content: "What happened to margins?" },
    ],
  });
  it("keeps the source id, branch id and turn ids in order", () => {
    expect(doc).toContain("src-1");
    expect(doc).toContain(ID);
    expect(doc.indexOf("t-1")).toBeLessThan(doc.indexOf("t-2"));
  });
  it("attributes claims instead of restating them", () => {
    expect(doc).toContain("> Margins fell 4%.");
    expect(doc).toContain("Dana's session");
  });
  it("contains no second person or instruction", () => {
    expect(doc).not.toMatch(/\byou\b|\byour\b|act as|please|next steps?/i);
  });
  it("uses no em dash in the record or the copy", () => {
    expect(doc).not.toContain("\u2014");
    for (const value of Object.values(BRANCH_COPY)) {
      const text = typeof value === "function" ? value("Claude") : value;
      expect(text).not.toContain("\u2014");
    }
  });
});

describe("branchOwnerLabel", () => {
  const members = [
    { id: "p-1", display_name: "Dana" },
    { id: "p-2", display_name: "  " },
  ];
  it("uses the resolved display name, whoever owns the source", () => {
    expect(branchOwnerLabel("p-1", members)).toBe("Dana");
  });
  it("falls back to the connector wording when the name cannot be read", () => {
    expect(branchOwnerLabel("p-2", members)).toBe("A teammate");
    expect(branchOwnerLabel("p-9", members)).toBe("A teammate");
    expect(branchOwnerLabel(null, members)).toBe("A teammate");
    expect(branchOwnerLabel("p-1", [])).toBe("A teammate");
  });
});

describe("branch targets", () => {
  it("builds the Claude and ChatGPT links", () => {
    expect(branchOpenPlan("claude", "hi there")).toEqual({ handoff: "link", url: "https://claude.ai/new?q=hi%20there" });
    expect(branchOpenPlan("chatgpt", "hi there")).toEqual({ handoff: "link", url: "https://chatgpt.com/?q=hi%20there" });
  });
  it("gives Gemini no prefill link", () => {
    expect(branchOpenPlan("gemini", "hi")).toEqual({ handoff: "clipboard", url: "https://gemini.google.com/app", reason: "no_prefill" });
  });
  it("falls back to the clipboard past the length guard", () => {
    const plan = branchOpenPlan("claude", "x".repeat(BRANCH_URL_LIMIT));
    expect(plan.handoff).toBe("clipboard");
  });
});
