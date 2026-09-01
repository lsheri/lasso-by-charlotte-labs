import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  ARTIFACT_KINDS,
  TASK_CLASSES,
  TOOL_VENDORS,
  TURN_BANDS,
  artifactKindFromItem,
  hasRevisionLoop,
  roleAlternation,
  taskClassForItem,
  threadShapeDims,
  turnBand,
  vendorFromSource,
} from "../work-taxonomy";

const VENDORS = new Set<string>(TOOL_VENDORS);
const KINDS = new Set<string>([...ARTIFACT_KINDS, "other"]);

describe("pass148 vocabulary closure", () => {
  it("names tools from stored vendor, source and URL host", () => {
    expect(vendorFromSource({ source_vendor: "claude" })).toBe("claude");
    expect(vendorFromSource({ source: "mcp:chatgpt" })).toBe("chatgpt");
    expect(vendorFromSource({ source_meta: { vendor: "gemini" } })).toBe("gemini");
    expect(vendorFromSource({ url: "https://www.perplexity.ai/search/abc" })).toBe("perplexity");
    expect(vendorFromSource({ url: "https://copilot.microsoft.com/x" })).toBe("copilot");
    expect(vendorFromSource({ url: "https://example.com/thread" })).toBe("other_ai");
    expect(vendorFromSource({ source: "upload" })).toBe("unknown");
    expect(vendorFromSource(null)).toBe("unknown");
  });

  it("never returns a value outside the closed vendor set", () => {
    const inputs = [
      null,
      undefined,
      "",
      "something odd",
      { source: "connector:googledrive" },
      { source_meta: { url: "not a url" } },
      { url: "https://claude.ai/chat/1" },
    ];
    for (const input of inputs) {
      expect(VENDORS.has(vendorFromSource(input as never))).toBe(true);
    }
  });

  it("never stores the URL itself, only the tool name", () => {
    expect(vendorFromSource({ url: "https://claude.ai/chat/secret-id" })).toBe("claude");
  });

  it("bands turn counts at the edges", () => {
    expect(turnBand(0)).toBe("1");
    expect(turnBand(1)).toBe("1");
    expect(turnBand(2)).toBe("2-5");
    expect(turnBand(5)).toBe("2-5");
    expect(turnBand(6)).toBe("6-15");
    expect(turnBand(15)).toBe("6-15");
    expect(turnBand(16)).toBe("16-40");
    expect(turnBand(40)).toBe("16-40");
    expect(turnBand(41)).toBe("40+");
    expect(TURN_BANDS).toContain(turnBand(9999));
  });

  it("maps items onto artifact kinds and task classes only", () => {
    expect(artifactKindFromItem({ type: "ai_thread" })).toBe("ai_thread");
    expect(artifactKindFromItem({ type: "deck" })).toBe("deck");
    expect(artifactKindFromItem({ type: "sheet" })).toBe("model_or_budget");
    expect(artifactKindFromItem({ type: "mystery" })).toBe("other");
    expect(artifactKindFromItem(null)).toBe("other");

    expect(taskClassForItem({ type: "sheet" })).toBe("analyze");
    expect(taskClassForItem({ type: "deck" })).toBe("communicate");
    expect(taskClassForItem({ type: "email" })).toBe("communicate");
    expect(taskClassForItem({ type: "document" })).toBe("draft");
    expect(taskClassForItem({ type: "code" })).toBe("build");
    expect(taskClassForItem({ type: "ai_thread" })).toBe("unknown");
    expect(taskClassForItem({ type: "mystery" })).toBe("unknown");

    for (const type of ["ai_thread", "deck", "sheet", "email", "code", "image", "nope"]) {
      expect(KINDS.has(artifactKindFromItem({ type }))).toBe(true);
      expect(TASK_CLASSES).toContain(taskClassForItem({ type }));
    }
  });
});

describe("pass148 thread shape", () => {
  it("calls the balance of the conversation", () => {
    expect(roleAlternation(5, 5)).toBe("balanced");
    expect(roleAlternation(8, 2)).toBe("user_heavy");
    expect(roleAlternation(2, 8)).toBe("assistant_heavy");
    expect(roleAlternation(0, 0)).toBe("balanced");
  });

  it("sees a revision loop only after position 3", () => {
    const long = "x".repeat(400);
    const short = "shorter";
    expect(
      hasRevisionLoop([
        { role: "user", length: long.length },
        { role: "assistant", length: long.length },
        { role: "user", length: short.length },
      ]),
    ).toBe(false);
    expect(
      hasRevisionLoop([
        { role: "user", length: long.length },
        { role: "assistant", length: long.length },
        { role: "user", length: long.length },
        { role: "assistant", length: long.length },
        { role: "user", length: short.length },
      ]),
    ).toBe(true);
    expect(
      hasRevisionLoop([
        { role: "user", length: long.length },
        { role: "assistant", length: long.length },
        { role: "user", length: long.length },
        { role: "assistant", length: long.length },
        { role: "user", length: long.length },
      ]),
    ).toBe(false);
  });

  it("produces a whole payload of bands and flags", () => {
    const dims = threadShapeDims([
      { role: "user", length: 500 },
      { role: "assistant", length: 900 },
      { role: "user", length: 500 },
      { role: "assistant", length: 900 },
      { role: "user", length: 20 },
      { role: "assistant", length: 900 },
    ]);
    expect(dims).toEqual({
      turn_band: "6-15",
      role_alternation: "balanced",
      has_revision_loop: true,
    });
  });
});

describe("pass148 registry and emission points", () => {
  const registry = readFileSync("src/lib/telemetry-shared.ts", "utf8");

  it("adds exactly the three new names, additively", () => {
    for (const name of ["model.used", "thread.shape", "handoff.observed"]) {
      expect(registry).toContain(`"${name}"`);
    }
    for (const kept of ["workitem.captured", "mcp.push", "consent.research_change"]) {
      expect(registry).toContain(`"${kept}"`);
    }
  });

  it("emits every new event through the stamped recordEvent path", () => {
    const emitter = readFileSync("src/lib/work-taxonomy.server.ts", "utf8");
    expect(emitter).toContain('from "./telemetry.server"');
    expect(emitter.match(/recordEvent\(/g)?.length).toBe(3);
  });

  it("emits model.used for a pushed conversation only when the thread is new", () => {
    const handler = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
    expect(handler).toContain('if (pushMode === "created") {');
    expect(handler).toContain("createdAttachmentTypes.push");
    // The shape is emitted on every push, outside the created-only branch.
    expect(handler).toContain("await noteThreadShape(");
  });

  it("emits a handoff when a link row is created", () => {
    const lineage = readFileSync("src/lib/lineage.server.ts", "utf8");
    expect(lineage).toContain("noteHandoffObserved");
  });

  it("keeps content and titles out of the taxonomy module", () => {
    const source = readFileSync("src/lib/work-taxonomy.ts", "utf8");
    expect(source).not.toContain(".content");
    expect(source).not.toContain("title");
  });
});
