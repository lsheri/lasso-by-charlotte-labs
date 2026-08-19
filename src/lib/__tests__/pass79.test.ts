import { describe, expect, it } from "vitest";

import {
  bulkShareDims,
  coachResultsLine,
  removalLine,
  rosterFor,
  sharedByMeCount,
  sharedSuccessLine,
} from "@/lib/coach-share-shared";
import {
  CLIENT_RENAME_REFUSAL,
  ENGAGEMENT_RENAME_REFUSAL,
  WORKSTREAM_RENAME_REFUSAL,
  saveOutcome,
} from "@/lib/save-guard";

describe("zero row refusal", () => {
  it("treats an empty update result as a refusal", () => {
    expect(saveOutcome({ data: [], error: null }, ENGAGEMENT_RENAME_REFUSAL)).toEqual({
      ok: false,
      message: ENGAGEMENT_RENAME_REFUSAL,
    });
    expect(saveOutcome({ data: null, error: null }, WORKSTREAM_RENAME_REFUSAL).ok).toBe(false);
  });

  it("passes through a real error message", () => {
    expect(saveOutcome({ data: null, error: { message: "boom" } }, CLIENT_RENAME_REFUSAL)).toEqual({
      ok: false,
      message: "boom",
    });
  });

  it("accepts a row that came back", () => {
    expect(saveOutcome({ data: [{ id: "a" }], error: null }, ENGAGEMENT_RENAME_REFUSAL)).toEqual({
      ok: true,
    });
  });
});

describe("roster state", () => {
  const coaches = [
    { id: "b", display_name: "Bea Nolan" },
    { id: "a", display_name: "Ada Lyle" },
  ];

  it("lists every active coach in name order with share state", () => {
    const rows = rosterFor(coaches, [{ id: "b", added_at: "2026-01-04", added_by_name: "Sam" }]);
    expect(rows.map((row) => row.display_name)).toEqual(["Ada Lyle", "Bea Nolan"]);
    expect(rows.map((row) => row.shared)).toEqual([false, true]);
    expect(rows[1]?.added_by_name).toBe("Sam");
  });

  it("lets an optimistic tap win, in both directions", () => {
    const shared = [{ id: "b", added_at: null, added_by_name: null }];
    expect(rosterFor(coaches, shared, { a: true })[0]?.shared).toBe(true);
    expect(rosterFor(coaches, shared, { b: false })[1]?.shared).toBe(false);
  });

  it("says what removal does and does not do", () => {
    expect(removalLine("Ada")).toBe(
      "Removed. Ada no longer sees this engagement. Nothing is deleted, and their past notes remain theirs.",
    );
    expect(sharedSuccessLine("Ada")).toBe("Shared. Ada can now see this engagement.");
  });

  it("reports partial and total bulk failure honestly", () => {
    const results = [
      { id: "a", label: "Ada", ok: true },
      { id: "b", label: "Bea", ok: false, message: "not permitted" },
    ];
    expect(coachResultsLine(results)).toBe(
      "Shared with 1 of 2 coaches. Bea did not share: not permitted.",
    );
    expect(coachResultsLine([results[0]!])).toBe(
      "Shared with 1 coaches. They can see this engagement now.",
    );
    expect(coachResultsLine([results[1]!])).toBe(
      "Shared with 0 of 1 coaches. Bea did not share: not permitted.",
    );
  });
});

describe("shared by me count", () => {
  it("counts distinct engagements the caller works on", () => {
    expect(
      sharedByMeCount(
        ["e1", "e2"],
        [{ engagement_id: "e1" }, { engagement_id: "e1" }, { engagement_id: "e3" }],
      ),
    ).toBe(1);
  });

  it("is zero when the caller works on nothing shared", () => {
    expect(sharedByMeCount([], [{ engagement_id: "e1" }])).toBe(0);
  });
});

describe("bulk telemetry", () => {
  it("carries a count and no identity", () => {
    const dims = bulkShareDims("shared", 4);
    expect(dims).toEqual({ action: "shared", bulk: true, count: 4 });
    expect(JSON.stringify(dims)).not.toMatch(/[a-f0-9]{8}-/);
  });
});
