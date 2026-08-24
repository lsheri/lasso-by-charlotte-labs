import { describe, expect, it } from "vitest";

import {
  analysisPreset,
  minItemsFor,
  needsMoreSelectedLine,
  notEnoughWorkLine,
  OUTPUT_DISCIPLINE,
} from "@/lib/analysis-presets";
import { datePrecisionLine, type ItemRow } from "@/lib/reflect-context.server";

describe("pass 99 · how this was made registry", () => {
  const preset = analysisPreset("how_this_was_made")!;

  it("is an engagement scoped analysis a coach may run", () => {
    expect(preset).toBeTruthy();
    expect(preset.scope).toBe("engagement");
    expect(preset.coachMayRun).toBe(true);
    expect(minItemsFor(preset)).toBe(2);
  });

  it("pins the time constraint and the refusal", () => {
    expect(preset.systemPrompt).toContain("TIME IS DATES AND ORDER");
    expect(preset.systemPrompt).toContain("If fewer than two items are in scope");
    expect(preset.systemPrompt).not.toContain("—");
  });

  it("carries the shared output discipline", () => {
    expect(preset.systemPrompt).toContain(OUTPUT_DISCIPLINE.trim().split("\n")[0]!);
  });
});

describe("pass 99 · per preset minimums", () => {
  it("lets a two item selection run a sequence but not a recurrence", () => {
    const sequence = analysisPreset("how_this_was_made")!;
    const recurs = analysisPreset("what_recurs")!;
    expect(2 >= minItemsFor(sequence)).toBe(true);
    expect(2 >= minItemsFor(recurs)).toBe(false);
    expect(needsMoreSelectedLine(sequence)).toBe("needs at least two pieces of work selected");
    expect(needsMoreSelectedLine(recurs)).toBe("needs at least three pieces of work selected");
    expect(notEnoughWorkLine(sequence)).not.toBe(notEnoughWorkLine(recurs));
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
