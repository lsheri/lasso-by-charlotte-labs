import { describe, expect, it } from "vitest";

import { BRANCH_REFUSAL, branchToolDim, decideBranchFetch, mergeBranchFetchMeta, type BranchRow } from "@/lib/branch-fetch";

const mine: BranchRow = { id: "b1", owner_id: "p-me", parent_work_item_id: "src", source_vendor: "claude", meta: {} };

describe("branch fetch refusal", () => {
  it("is identical for missing, not yours and unreadable source", () => {
    const missing = decideBranchFetch({ branch: null, callerProfileId: "p-me", sourceReadable: true });
    const notYours = decideBranchFetch({ branch: { ...mine, owner_id: "p-other" }, callerProfileId: "p-me", sourceReadable: true });
    const unreadable = decideBranchFetch({ branch: mine, callerProfileId: "p-me", sourceReadable: false });
    for (const result of [missing, notYours, unreadable]) expect(result).toEqual({ ok: false, message: BRANCH_REFUSAL });
  });
  it("allows the owner when the source is readable", () => {
    expect(decideBranchFetch({ branch: mine, callerProfileId: "p-me", sourceReadable: true })).toEqual({ ok: true, sourceId: "src" });
  });
});

describe("branch fetch meta", () => {
  it("keeps unrelated keys and increments the count", () => {
    const start = { other: 1, branch: { tool: "claude", source_work_item_id: "src", fetch_count: 2 } };
    const { meta, count } = mergeBranchFetchMeta(start, "2026-10-14T03:00:00Z");
    expect(meta["other"]).toBe(1);
    expect(meta["branch"]).toEqual({ tool: "claude", source_work_item_id: "src", fetch_count: 3, fetched_at: "2026-10-14T03:00:00Z" });
    expect(count).toBe(3);
  });
  it("marks only the first fetch as first", () => {
    const one = mergeBranchFetchMeta({ branch: { tool: "claude" } }, "t1");
    expect(one.first).toBe(true);
    const two = mergeBranchFetchMeta(one.meta, "t2");
    expect(two.first).toBe(false);
  });
  it("reads the tool from the stored vendor", () => {
    expect(branchToolDim("openai")).toBe("openai");
    expect(branchToolDim(null)).toBe("other");
  });
});
