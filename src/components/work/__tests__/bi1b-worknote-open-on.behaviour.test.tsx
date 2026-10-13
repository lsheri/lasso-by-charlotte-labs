// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkNote } from "@/components/work/WorkNote";
import type { WorkItemRow } from "@/lib/work-types";

const item = { id: "w1", title: "Market memo", type: "document", source: "claude", source_vendor: "claude", visibility: "mapped", captured_at: "2026-09-24T10:00:00Z", content_ref: null, source_meta: {}, meta: {}, work_item_tasks: [] } as unknown as WorkItemRow;
const body = (c: HTMLElement) => c.querySelector(".nb-paper-body") as HTMLElement;
afterEach(cleanup);

describe("BI-1b WorkNote openOn", () => {
  it("default: single click opens and the body is a button", () => {
    const onOpen = vi.fn();
    const { container } = render(<WorkNote item={item} onOpen={onOpen} />);
    fireEvent.click(body(container));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(body(container).getAttribute("role")).toBe("button");
    expect(body(container).getAttribute("tabindex")).toBe("0");
  });
  it("doubleClick: single click does not open, double click does, body is not a control", () => {
    const onOpen = vi.fn();
    const { container } = render(<WorkNote item={item} onOpen={onOpen} openOn="doubleClick" />);
    fireEvent.click(body(container));
    fireEvent.keyDown(body(container), { key: "Enter" });
    expect(onOpen).not.toHaveBeenCalled();
    fireEvent.doubleClick(body(container));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(body(container).hasAttribute("role")).toBe(false);
    expect(body(container).hasAttribute("tabindex")).toBe(false);
    expect(body(container).hasAttribute("aria-label")).toBe(false);
    expect(body(container).className).not.toContain("cursor-pointer");
  });
});
