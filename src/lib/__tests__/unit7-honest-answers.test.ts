import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auditReadRows } from "@/components/reflect/ContextTrail";
import type { ContextManifest } from "@/lib/context-manifest";

const calls: { messages: { role: string; content: string }[] }[] = [];
let replies: string[] = [];

vi.mock("@/lib/ai.server", () => ({
  chatComplete: vi.fn(async (messages: { role: string; content: string }[], opts: { tools?: unknown }) => {
    calls.push({ messages: [...messages] });
    if (opts?.tools) return { text: "", toolCalls: [], tokensIn: 1, tokensOut: 1, costUsd: 0, finishReason: "stop" };
    return { text: replies.shift() ?? "", toolCalls: [], tokensIn: 1, tokensOut: 1, costUsd: 0, finishReason: "stop" };
  }),
  streamChat: vi.fn(),
}));
vi.mock("@/lib/record-catalogue.server", () => ({
  buildCatalogue: vi.fn(async () => ({
    brief: { block: "", chars: 0, reads: [], sources: [], itemIds: [] },
    structure: [],
    entries: [],
    prefetched: new Map(),
  })),
  catalogueLine: () => "",
}));
vi.mock("@/lib/record-tools.server", () => ({ RECORD_TOOLS: [], runRecordTool: vi.fn() }));
vi.mock("@/lib/reflect-context.server", () => ({ RAW_BUDGET: 1000 }));

const run = async () => {
  const { runCatalogueAnswer } = await import("@/lib/record-answer.server");
  return runCatalogueAnswer({} as never, {
    ownerId: "p",
    scope: { mode: "whole", ids: [] },
    prompts: [],
    history: [],
    question: "Can you look this up online?",
    meta: {} as never,
  });
};

describe("unit 7 catalogue write call", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("sends the write call without CATALOGUE_RULES and with ANSWER_RULES", async () => {
    const { CATALOGUE_RULES, ANSWER_RULES } = await import("@/lib/record-answer.server");
    replies = ["No, I cannot browse the web."];
    const result = await run();
    const write = calls[calls.length - 1]!.messages;
    expect(write.some((m) => m.content === CATALOGUE_RULES)).toBe(false);
    expect(write.some((m) => m.content === ANSWER_RULES)).toBe(true);
    expect(result.answerRetried).toBe(false);
  });

  it("asks once more when the answer is READY", async () => {
    replies = ["READY.", "No, I cannot browse the web."];
    const result = await run();
    expect(result.answer).toBe("No, I cannot browse the web.");
    expect(result.answerRetried).toBe(true);
    expect(calls[calls.length - 1]!.messages.at(-1)!.content).toBe("Write the full answer now.");
  });

  it("records answer_retried on reflect.message_sent", () => {
    expect(readFileSync("src/lib/reflect-run.server.ts", "utf8")).toContain("answer_retried: run.answerRetried,");
  });
});

describe("unit 7 trail rows", () => {
  it("keeps catalogue and unreadable reads out of READ", () => {
    const manifest: ContextManifest = {
      engagement: null,
      brief_included: false,
      firm_checks_applied: 0,
      items: [{ id: "a", title: "Opened", kind: "item", detail: "" } as ContextManifest["items"][number]],
      excluded: [{ title: "Listed", reason: "listed, not opened" }],
      assembled_at: "",
    };
    const rows = auditReadRows(manifest, [
      { id: "a", title: "Opened", type: "chat", source_vendor: null, depth: "extract" },
      { id: "b", title: "Listed", type: "chat", source_vendor: null, depth: "catalogue" },
      { id: "c", title: "Broken", type: "file", source_vendor: null, depth: "unreadable" },
    ]);
    expect(rows.map((r) => r.title)).toEqual(["Opened"]);
  });
});
