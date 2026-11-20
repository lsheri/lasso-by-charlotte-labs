// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SKELETON_FRAME_COPY, SkeletonFrame } from "@/components/ui/skeleton-frame";

afterEach(cleanup);

describe("SkeletonFrame", () => {
  it("is one quiet status line for a screen reader, with the bars hidden from it", () => {
    render(<SkeletonFrame label="Loading proposals" />);
    const status = screen.getByRole("status");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.textContent).toBe("Loading proposals");
    expect(status.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("says Loading when no label is given", () => {
    render(<SkeletonFrame />);
    expect(screen.getByRole("status").textContent).toBe(SKELETON_FRAME_COPY.label);
  });

  it.each([
    ["rows", 4, "li"],
    ["stats", 3, ".border-t"],
    ["cards", 2, ".h-32"],
  ] as const)("draws %s in the number asked for", (shape, count, selector) => {
    render(<SkeletonFrame shape={shape} count={count} />);
    const frame = screen.getByTestId("skeleton-frame");
    expect(frame.getAttribute("data-shape")).toBe(shape);
    expect(frame.querySelectorAll(selector)).toHaveLength(count);
  });

  it("draws a single panel whatever the count", () => {
    render(<SkeletonFrame shape="panel" count={9} />);
    expect(screen.getByTestId("skeleton-frame").querySelectorAll(".border").length).toBe(1);
  });

  it("keeps the count between one and twelve", () => {
    const { unmount } = render(<SkeletonFrame shape="rows" count={0} />);
    expect(screen.getByTestId("skeleton-frame").querySelectorAll("li")).toHaveLength(1);
    unmount();
    render(<SkeletonFrame shape="rows" count={500} />);
    expect(screen.getByTestId("skeleton-frame").querySelectorAll("li")).toHaveLength(12);
  });

  it("stands still under reduced motion and uses no spinner", () => {
    render(<SkeletonFrame shape="stats" count={2} />);
    const frame = screen.getByTestId("skeleton-frame");
    const bars = frame.querySelectorAll(".animate-pulse");
    expect(bars.length).toBeGreaterThan(0);
    for (const bar of bars) expect(bar.className).toContain("motion-reduce:animate-none");
    expect(frame.innerHTML).not.toMatch(/spin/);
  });
});
