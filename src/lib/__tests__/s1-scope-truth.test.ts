import { describe, expect, it } from "vitest";

import { parseManifest } from "@/lib/context-manifest";
import { loadScopeData } from "@/lib/reflect-context.server";
import { parseScopeSource, scopeLabel } from "@/lib/reflect-shared";

describe("S1 scope truth", () => {
  it("never labels an empty item scope as the whole record", () => {
    expect(scopeLabel({ mode: "items", ids: [] })).toBe("No work items");
  });

  it("does not query or return work for an empty item scope", async () => {
    await expect(loadScopeData({} as never, "profile", { mode: "items", ids: [] })).resolves.toEqual({ tasks: [], linkRows: [], items: [] });
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
describe("S1.2 scope truth follow-up", () => {
  const empty = { engagement: null, brief_included: false, firm_checks_applied: 0, items: [], excluded: [], assembled_at: "now" };
  it("keeps a scoped empty manifest and still drops an unscoped one", () => {
    expect(parseManifest(empty)).toBeNull();
    expect(parseManifest({ ...empty, scope: { source: "board_pick_brief_only", picked: 0 } })?.scope).toEqual({ source: "board_pick_brief_only", picked: 0 });
  });

  it("tells the model 'I read' means this question only", async () => {
    const { THIS_TURN_RULE, ASK_LASSO_MAKING_RULES, REFLECT_SYSTEM_PROMPT } = await import("@/lib/reflect-shared");
    expect(THIS_TURN_RULE).toContain("earlier in this chat");
    expect(ASK_LASSO_MAKING_RULES).toContain(THIS_TURN_RULE);
    expect(REFLECT_SYSTEM_PROMPT).toContain(THIS_TURN_RULE);
  });

  it("records a menu pick through the workboard guard", async () => {
    const { guardWorkboardEvent } = await import("@/lib/workboard-event-allowlist");
    expect(guardWorkboardEvent("workboard.context_changed", { action: "menu" })).toEqual({ keep: true, dims: { action: "menu" } });
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/pages/CanvasLabPage.tsx", "utf8")).toContain('noteWorkboardContextChanged(orgId, "menu")');
  });

  it("labels the brief field Brief in both engagement dialogs", async () => {
    const { readFileSync } = await import("node:fs");
    expect(readFileSync("src/components/engagements/EditEngagementDialog.tsx", "utf8")).toMatch(/edit-eng-brief" className="micro-label">\s*Brief\s*</);
    expect(readFileSync("src/components/engagements/NewEngagementDialog.tsx", "utf8")).toContain("Brief (optional)");
  });
});
