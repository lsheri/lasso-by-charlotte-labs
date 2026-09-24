import { describe, expect, it } from "vitest";

import { parseManifest } from "@/lib/context-manifest";
import { parseScopeSource, scopeLabel } from "@/lib/reflect-shared";

describe("S1 scope truth", () => {
  it("never labels an empty item scope as the whole record", () => {
    expect(scopeLabel({ mode: "items", ids: [] })).toBe("No work items");
  });

  it("normalizes scope_source to the closed set", () => {
    expect(parseScopeSource("board_pick_brief_only")).toBe("board_pick_brief_only");
    expect(parseScopeSource("anything_else")).toBe("all");
  });

  it("parses additive scope metadata and tolerates an old manifest", () => {
    const base = {
      engagement: { id: "e", name: "Engagement" },
      brief_included: true,
      firm_checks_applied: 0,
      items: [],
      excluded: [],
      assembled_at: "now",
    };
    expect(parseManifest(base)?.scope).toBeUndefined();
    expect(parseManifest({ ...base, scope: { source: "board_pick", picked: 4 } })?.scope).toEqual({ source: "board_pick", picked: 4 });
  });
});