// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CORNER_STICKY_COPY, CardCornerSticky } from "@/components/canvas-lab/CardCornerSticky";

afterEach(cleanup);

describe("S3 the corner sticky on a card", () => {
  it("shows a real-paper sticky with the count, and names it as stickies on the work", () => {
    render(<CardCornerSticky count={2} onOpen={vi.fn()} />);
    const button = screen.getByTestId("card-corner-sticky");
    expect(button.textContent).toBe("2");
    expect(button.getAttribute("aria-label")).toBe("2 open stickies on this work");
    expect(button.querySelector('svg[data-sticky-mark="sheet"]')).toBeTruthy();
    expect(CORNER_STICKY_COPY.label(1)).toBe("1 open sticky on this work");
  });
  it("is not drawn when the work has no open stickies", () => {
    render(<CardCornerSticky count={0} onOpen={vi.fn()} />);
    expect(screen.queryByTestId("card-corner-sticky")).toBeNull();
  });
  it("caps the number it draws at 9+", () => {
    render(<CardCornerSticky count={14} onOpen={vi.fn()} />);
    expect(screen.getByTestId("card-corner-sticky").textContent).toBe("9+");
    expect(screen.getByTestId("card-corner-sticky").getAttribute("aria-label")).toBe(
      "14 open stickies on this work",
    );
  });
  it("a press opens the work's stickies and never reaches the card underneath", () => {
    const onOpen = vi.fn();
    const onCard = vi.fn();
    render(
      <div onClick={onCard} onPointerDown={onCard} onDoubleClick={onCard}>
        <CardCornerSticky count={1} onOpen={onOpen} />
      </div>,
    );
    const button = screen.getByTestId("card-corner-sticky");
    fireEvent.pointerDown(button);
    fireEvent.click(button);
    fireEvent.doubleClick(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onCard).not.toHaveBeenCalled();
  });
});

describe("S3 wiring (pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const card = readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8");
  const server = readFileSync("src/lib/stickies.server.ts", "utf8");
  const hook = readFileSync("src/hooks/use-stickies.ts", "utf8");
  it("only the signed-in board passes counts, and the corner sticky opens the Stickies tab", () => {
    expect(page).toContain(
      "stickyCount={node.workItemId ? stickyCounts[node.workItemId] ?? 0 : 0}",
    );
    expect(page).toContain(
      'liftCard(node, cardItem, cardRect(node.id), "stickies"); noteWorkboardStickyOpened(orgId, "card");',
    );
    expect(card).toContain(
      "{readOnly ? null : <CardCornerSticky count={stickyCount} onOpen={onOpenStickies} />}",
    );
  });
  it("counts open stickies per piece of work on this board, as the reader, never per person", () => {
    const fn = server.slice(server.indexOf("export async function listStickyCounts"));
    expect(fn).toContain('.eq("kind", "sticky")');
    expect(fn).toContain('.is("done_at", null)');
    expect(fn).toContain('.select("work_item_id")');
    expect(fn).not.toMatch(/author_profile_id|assignee_profile_id/);
  });
  it("a new or removed sticky refreshes the corner sticky", () => {
    expect(hook).toContain("queryKey: stickyCountsQueryKey(engagementId)");
  });
});
