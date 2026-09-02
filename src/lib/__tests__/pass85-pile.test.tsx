// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BUCKETS, bucketFor } from "@/components/work/work-buckets";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(cleanup);

function item(id: string, type: WorkItemRow["type"], title: string): WorkItemRow {
  return {
    id,
    title,
    type,
    source: "upload",
    visibility: "unmapped",
    captured_at: "2026-08-01T00:00:00Z",
    content_ref: null,
    work_item_tasks: [],
  } as unknown as WorkItemRow;
}

describe("pass 85 type matrix", () => {
  it("has exactly four buckets, each with a letter", () => {
    expect(BUCKETS.map((b) => b.label)).toEqual([
      "Documents",
      "Presentations",
      "Call transcripts",
      "LLM transcripts",
    ]);
    for (const bucket of BUCKETS) expect(bucket.letter).toHaveLength(1);
  });

  it("folds sheet, email, message and image into Documents", () => {
    for (const type of ["document", "sheet", "email", "message", "image"] as const) {
      expect(bucketFor(type).key).toBe("documents");
    }
    expect(bucketFor("deck").key).toBe("presentations");
    expect(bucketFor("call").key).toBe("calls");
    expect(bucketFor("ai_thread").key).toBe("llm");
  });
});

describe("pass 85 css", () => {
  const css = readFileSync("src/styles.css", "utf8");

  // Pass 94 replaced the stacked pile with the scatter field; the quad surface
  // and the tab bar survive the swap.
  it("ships the quad surface, the paper card and the tab bar", () => {
    expect(css).toContain(".nb-quad");
    expect(css).toContain(".nb-paper");
    expect(css).toContain(".nb-tabbar");
  });

  it("swaps instantly under reduced motion", () => {
    const block = css
      .split("@media (prefers-reduced-motion: reduce)")
      .find((chunk) => chunk.includes(".nb-paper")) ?? "";
    expect(block).toContain(".nb-paper");
    expect(block).toContain("transition: none !important");
  });
});
