import { describe, expect, it } from "vitest";

import {
  analysisPreset,
  minItemsFor,
  needsMoreSelectedLine,
  notEnoughWorkLine,
  OUTPUT_DISCIPLINE,
} from "@/lib/analysis-presets";
import { datePrecisionLine, type ItemRow } from "@/lib/reflect-context.server";

describe("pass 99 · retired engagement analyses", () => {
  it("no longer registers the two presets pass 103 removed", () => {
    expect(analysisPreset("how_this_was_made")).toBeNull();
    expect(analysisPreset("what_recurs")).toBeNull();
  });

  it("keeps the shared output discipline on what survives", () => {
    const preset = analysisPreset("verification")!;
    expect(preset.systemPrompt).toContain(OUTPUT_DISCIPLINE.trim().split("\n")[0]!);
    expect(minItemsFor(preset)).toBe(1);
    expect(needsMoreSelectedLine(preset)).toContain("at least");
    expect(notEnoughWorkLine(preset)).toBeTruthy();
  });
});

describe("pass 99 · date precision headers", () => {
  const base = {
    id: "i1",
    title: "t",
    type: "document",
    source: "drive",
    visibility: "mapped",
    captured_at: "2026-05-10T00:00:00Z",
    work_date: null,
    created_at_source: null,
    content_fidelity: null,
    source_vendor: null,
    content_ref: null,
    meta: null,
    source_meta: null,
  } as unknown as ItemRow;

  it("prefers a modified date, then a sent date", () => {
    expect(
      datePrecisionLine({ ...base, source_meta: { modified_at: "2026-04-01T10:00:00Z" } } as ItemRow),
    ).toBe("modified 2026-04-01");
    expect(
      datePrecisionLine({ ...base, source_meta: { sent_at: "2026-03-02T10:00:00Z" } } as ItemRow),
    ).toBe("sent 2026-03-02");
  });

  it("states a source work date plainly and never dresses up a capture date", () => {
    expect(
      datePrecisionLine({ ...base, work_date: "2026-02-02", ts_precision: "source" } as ItemRow),
    ).toBe("2026-02-02");
    expect(datePrecisionLine({ ...base, work_date: "2026-02-02" } as ItemRow)).toBe(
      "captured 2026-05-10",
    );
  });
});
