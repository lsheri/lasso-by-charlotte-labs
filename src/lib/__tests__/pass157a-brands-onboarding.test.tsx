// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { VendorBrandMark } from "@/components/work/VendorBrandMark";
import { VISIBLE_PURPOSE_COPY, PURPOSE_COPY } from "@/lib/consent-shared";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(cleanup);

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    title: "A conversation",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: "2026-01-01T00:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "transcribed",
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

describe("data use section", () => {
  it("no longer offers the research card", () => {
    expect(VISIBLE_PURPOSE_COPY.some((p) => p.purpose === "research")).toBe(false);
    // Pass 158: the research switch copy is removed entirely; one card asks.
    expect(PURPOSE_COPY.some((p) => p.purpose === "research")).toBe(false);
  });

  it("starts deidentified improvement on, with a plain line", () => {
    const purpose = VISIBLE_PURPOSE_COPY.find((p) => p.purpose === "deidentified_improvement");
    expect(purpose?.defaultOn).toBe(true);
    expect(purpose?.note).toBe("On by default. Turn it off here or any time in Settings.");
  });
});

describe("chat library brand marks", () => {
  it("names the tool for a known vendor", () => {
    render(<VendorBrandMark item={item()} />);
    expect(screen.getByRole("img", { name: "Claude" })).toBeTruthy();
  });

  it("renders nothing for a tool it cannot name", () => {
    const { container } = render(
      <VendorBrandMark item={item({ source: "upload", source_vendor: null })} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
