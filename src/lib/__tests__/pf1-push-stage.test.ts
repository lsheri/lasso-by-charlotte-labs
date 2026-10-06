import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { windowPos } from "@/lib/mcp-handler.server";
import { EVENT_DIM_KEYS, guardEventDims } from "@/lib/event-dim-allowlist";

describe("windowPos", () => {
  it("classifies a push window's position in its conversation", () => {
    expect(windowPos(null)).toBe("only");
    expect(windowPos({ from: 1, to: 10, total: 30 })).toBe("first");
    expect(windowPos({ from: 11, to: 20, total: 30 })).toBe("middle");
    expect(windowPos({ from: 21, to: 30, total: 30 })).toBe("last");
    expect(windowPos({ from: 1, to: 30, total: 30 })).toBe("only");
  });
});

describe("the mcp.push allowlist", () => {
  it("admits stage and window_pos", () => {
    const kept = guardEventDims("mcp.push", { stage: "capture", window_pos: "first" }).dims;
    expect(kept["stage"]).toBe("capture");
    expect(kept["window_pos"]).toBe("first");
  });

  it("still drops a key that is not listed", () => {
    const kept = guardEventDims("mcp.push", { stage: "capture", not_a_dim: "x" }).dims;
    expect("not_a_dim" in kept).toBe(false);
  });

  it("keeps the mcp.push dim list alphabetical", () => {
    const keys = EVENT_DIM_KEYS["mcp.push"]!;
    const sorted = [...keys].sort((a, b) => a.localeCompare(b));
    expect(keys).toEqual(sorted);
  });
});

describe("push stages in the MCP handler", () => {
  // Driving the full MCP handler in a unit test is impractical, so these
  // assert from the source text.
  const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

  it("passes a stage at every logPush call site", () => {
    const calls = source.match(/logPush\(/g) ?? [];
    // One is the function definition itself; the rest are call sites.
    const callSites = calls.length - 1;
    const staged = source.match(/logPush\([\s\S]*?,\s*"(?:options|capture|helper)"\s*\)/g) ?? [];
    expect(callSites).toBeGreaterThan(0);
    expect(staged.length).toBe(callSites);
  });

  it('uses "capture" as a stage on exactly the three capture paths', () => {
    // The rule comment above logPush exists exactly once.
    expect(source.match(/stage is "capture" on exactly the paths/g)?.length).toBe(1);
    // Two logPush call sites pass "capture" (push_thread, push_document)...
    expect(source.match(/,\s*"capture"\s*\)/g)?.length).toBe(2);
    // ...and the inline mcp.push in pushConversation sets it as a dim.
    expect(source.match(/stage:\s*"capture"/g)?.length).toBe(1);
    // No logPush call site passes "options" more than once or "helper" other
    // than the four helper tools.
    expect(source.match(/,\s*"options"\s*\)/g)?.length).toBe(1);
    expect(source.match(/,\s*"helper"\s*\)/g)?.length).toBe(4);
  });
});
