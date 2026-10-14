import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");

describe("CARRY-1 wiring", () => {
  it("admits both dims on mcp.push, still sorted", () => {
    const keys = EVENT_DIM_KEYS["mcp.push"]!;
    expect(keys).toContain("carry_gaps");
    expect(keys).toContain("carry_evidence");
    expect(keys).toEqual([...keys].sort((a, b) => a.localeCompare(b)));
  });
  it("sends each dim exactly once", () => {
    expect(source.match(/carry_gaps:/g)?.length).toBe(1);
    expect(source.match(/carry_evidence:/g)?.length).toBe(1);
  });
  it("keeps the guard that stops this failing a push", () => {
    expect(source).toContain("a carry gap is never worth failing a push over");
  });
});
