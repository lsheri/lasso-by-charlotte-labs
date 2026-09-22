import { fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GroupingNamePopup, groupingNamePopupPosition } from "@/components/canvas-lab/GroupingNamePopup";
import { REGION_NAMING_LINE } from "@/lib/board-region";

const frame = { id: "region:five", name: "", x: 200, y: 300, width: 400, height: 220 };

describe("R4.1 grouping name popup", () => {
  it("keeps a fixed screen-pixel size while its position follows zoom", () => {
    const small = groupingNamePopupPosition(frame, { x: 10, y: 20 }, 0.5, { width: 1000, height: 800 }, { width: 320, height: 92 });
    const large = groupingNamePopupPosition(frame, { x: 10, y: 20 }, 1.5, { width: 1000, height: 800 }, { width: 320, height: 92 });
    expect(small.width).toBe(320);
    expect(large.width).toBe(320);
    expect(large.left).not.toBe(small.left);
  });

  it("prefers above and flips below near the top while staying on screen", () => {
    expect(groupingNamePopupPosition(frame, { x: 0, y: 0 }, 1, { width: 1000, height: 800 }, { width: 320, height: 92 }).side).toBe("above");
    const nearTop = groupingNamePopupPosition({ ...frame, y: 2 }, { x: 0, y: 0 }, 0.5, { width: 500, height: 300 }, { width: 320, height: 92 });
    expect(nearTop.side).toBe("below");
    expect(nearTop.top).toBeGreaterThanOrEqual(8);
    expect(nearTop.left).toBeGreaterThanOrEqual(8);
  });

  it("portals outside the grouping and dismisses through X, Escape, and click-away", () => {
    const portalRoot = document.createElement("div");
    document.body.append(portalRoot);
    const onDismiss = vi.fn();
    const view = render(<div data-testid="clipping-frame"><GroupingNamePopup frame={frame} pan={{ x: 0, y: 0 }} zoom={1} viewport={{ width: 1000, height: 800 }} portalRoot={portalRoot} onName={vi.fn()} onDismiss={onDismiss} /></div>);
    const popup = portalRoot.querySelector('[data-grouping-name-popup="true"]');
    expect(popup).not.toBeNull();
    expect(view.getByTestId("clipping-frame").contains(popup)).toBe(false);
    expect(view.getByLabelText("Name this grouping")).toHaveFocus();
    expect(portalRoot.textContent).toContain(REGION_NAMING_LINE);
    fireEvent.click(view.getByLabelText("Dismiss naming"));
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerDown(document.body);
    expect(onDismiss).toHaveBeenCalledTimes(3);
    expect(document.body.innerHTML).not.toMatch(/localStorage|sessionStorage/);
    portalRoot.remove();
  });
});