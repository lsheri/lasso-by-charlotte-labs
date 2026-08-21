// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { BUCKETS, bucketFor } from "@/components/work/work-buckets";
import { WorkPile } from "@/components/work/WorkPile";
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

describe("pass 85 pile", () => {
  const entries = [
    item("a", "document", "Scope note"),
    item("b", "deck", "Steerco deck"),
    item("c", "ai_thread", "Claude thread"),
  ];

  it("shows the stack first and resolves to the matrix from the toggle", () => {
    render(<WorkPile entries={entries} renderEntry={(e) => <div>{(e as WorkItemRow).title}</div>} />);
    expect(screen.getByRole("button", { name: /Open as matrix/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Matrix" }));
    expect(screen.getByText("Documents")).toBeTruthy();
    expect(screen.getByText("Steerco deck")).toBeTruthy();
  });

  it("pins the matrix when the rows themselves are needed", () => {
    render(
      <WorkPile
        entries={entries}
        forceMatrix
        renderEntry={(e) => <div>{(e as WorkItemRow).title}</div>}
      />,
    );
    expect(screen.queryByRole("button", { name: /Open as matrix/ })).toBeNull();
    expect(screen.getByText("Claude thread")).toBeTruthy();
  });
});

describe("pass 85 css", () => {
  const css = readFileSync("src/styles.css", "utf8");

  it("ships the quad surface, the stacked pile card and the tab bar", () => {
    expect(css).toContain(".nb-quad");
    expect(css).toContain('.nb-pile-card[data-stacked="1"]');
    expect(css).toContain(".nb-tabbar");
  });

  it("swaps instantly under reduced motion", () => {
    const block = css.slice(css.lastIndexOf("@media (prefers-reduced-motion: reduce)"));
    expect(block).toContain(".nb-pile-card");
    expect(block).toContain("transition: none !important");
  });
});
