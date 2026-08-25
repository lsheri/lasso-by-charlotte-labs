// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { DELETE_CONFIRM_LINE, StitchTabs } from "@/components/provenance/StitchTabs";
import type { AuditStitch } from "@/lib/span-provenance.functions";

afterEach(cleanup);

const LONG =
  "A far longer circled sentence than any tab could ever carry in one short line";

function stitch(id: string, snippet = LONG, minute = 1): AuditStitch {
  return {
    id,
    status: "exact",
    created_at: `2026-03-01T00:${String(minute).padStart(2, "0")}:00.000Z`,
    locator: { snippet },
    question: snippet,
  } as unknown as AuditStitch;
}

function rail(stitches: AuditStitch[], canDelete = true) {
  return render(
    <StitchTabs
      stitches={stitches}
      activeId={null}
      canDelete={canDelete}
      onSelect={() => {}}
      onNew={() => {}}
      onCopyLink={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe("pass 117: the question rail grows up", () => {
  it("wraps instead of hiding questions in a thin scrolling strip", () => {
    rail([stitch("s1")]);
    const container = screen.getByTestId("stitch-tabs");
    expect(container.className).toContain("flex-wrap");
    expect(container.className).not.toContain("overflow-x-auto");
  });

  it("says the whole question on hover and lets CSS decide where it stops", () => {
    rail([stitch("s1")]);
    const tab = screen.getByTestId("stitch-tab-s1");
    expect(tab.getAttribute("title")).toBe(LONG);
    expect(tab.querySelector("span.truncate")?.className).toContain("lg:max-w-[320px]");
  });

  it("opens the housekeeping outside the rail, so nothing can clip it", () => {
    rail([stitch("s1")]);
    fireEvent.click(screen.getByTestId("stitch-tab-menu-s1"));
    const menu = screen.getByTestId("stitch-tab-overflow-s1");
    expect(screen.getByTestId("stitch-tabs").contains(menu)).toBe(false);
  });

  it("names the question being removed, right above the confirm line", () => {
    rail([stitch("s1")]);
    fireEvent.click(screen.getByTestId("stitch-tab-menu-s1"));
    fireEvent.click(screen.getByTestId("stitch-tab-delete-s1"));
    const confirm = screen.getByTestId("stitch-tab-confirm-s1");
    expect(confirm.textContent).toContain(LONG);
    expect(confirm.textContent).toContain(DELETE_CONFIRM_LINE);
  });

  it("keeps Copy link for a coach and never offers Remove", () => {
    rail([stitch("s1")], false);
    fireEvent.click(screen.getByTestId("stitch-tab-menu-s1"));
    expect(screen.getByTestId("stitch-tab-copy-s1")).toBeTruthy();
    expect(screen.queryByTestId("stitch-tab-delete-s1")).toBeNull();
  });

  it("holds a long history back behind one quiet toggle", () => {
    const many = Array.from({ length: 9 }, (_, i) => stitch(`s${i}`, `Question ${i}`, i + 1));
    rail(many);
    expect(screen.getAllByTestId(/^stitch-tab-s\d$/)).toHaveLength(8);
    const toggle = screen.getByTestId("stitch-tabs-toggle");
    expect(toggle.textContent).toBe("All questions (9)");
    fireEvent.click(toggle);
    expect(screen.getAllByTestId(/^stitch-tab-s\d$/)).toHaveLength(9);
    expect(screen.getByTestId("stitch-tabs-toggle").textContent).toBe("Fewer");
  });

  it("offers no toggle at eight questions or fewer", () => {
    const eight = Array.from({ length: 8 }, (_, i) => stitch(`s${i}`, `Question ${i}`, i + 1));
    rail(eight);
    expect(screen.queryByTestId("stitch-tabs-toggle")).toBeNull();
  });
});
