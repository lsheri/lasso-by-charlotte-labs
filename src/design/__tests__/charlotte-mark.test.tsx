// @vitest-environment jsdom
// P2c: the Charlotte mark's weights, growth and loop behave as the 13 Nov spec says, and stay out of the app.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CharlotteMark } from "@/design/brand/CharlotteMark";
import { MONO_SPOKES, cycleAt, growFrame, wmVars } from "@/design/brand/charlotte-mark";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const spokeCount = (d: string) => d.split("M32 32").length - 1;

afterEach(() => vi.restoreAllMocks());

describe("Charlotte mark geometry", () => {
  it("switches to the heavier small weights at 24px and below", () => {
    expect(wmVars(24)).toMatchObject({ small: true, k: 0.75, sw: 3.9, ws: 2.55, hub: 6.5 });
    expect(wmVars(25)).toMatchObject({ small: false, k: 0.55, sw: 1.98, ws: 0.99, hub: 4 });
  });

  it("closes the gap between p 0.3 and 0.7", () => {
    expect(growFrame(0.3, 64).gap).toBe(45);
    const mid = growFrame(0.5, 64).gap;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(45);
    expect(growFrame(0.7, 64).gap).toBe(0);
    // Closed, the arc becomes two half circles.
    expect(growFrame(0.7, 64).arc.match(/A/g)).toHaveLength(2);
  });

  it("starts as the Monoline C and ends with all eight spokes", () => {
    expect(growFrame(0, 64).spokes).toBe(MONO_SPOKES);
    expect(spokeCount(growFrame(1, 64).spokes)).toBe(8);
  });

  it("never draws nodes, or the outer ring, at 24px and below", () => {
    expect(growFrame(1, 24).nodes).toEqual([]);
    expect(growFrame(1, 16).rings.map((r) => r.visible)).toEqual([true, false]);
    expect(growFrame(1, 32).nodes).toHaveLength(8);
    expect(growFrame(1, 32).rings.map((r) => r.visible)).toEqual([true, true]);
  });

  it("grows for 4.4s, holds, then fades from 6.0s to 6.4s", () => {
    expect(cycleAt(0)).toEqual({ p: 0, opacity: 1 });
    expect(cycleAt(4.4).p).toBe(1);
    expect(cycleAt(5.9)).toEqual({ p: 1, opacity: 1 });
    expect(cycleAt(6.2).opacity).toBe(0.5);
    expect(cycleAt(6.4)).toEqual({ p: 0, opacity: 1 });
  });
});

describe("CharlotteMark", () => {
  it("runs one loop while reading and stops it when reading ends", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 7);
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    const { rerender } = render(<CharlotteMark state="reading" size={64} reducedMotion={false} />);
    expect(raf).toHaveBeenCalledTimes(1);
    rerender(<CharlotteMark state="idle" size={64} reducedMotion={false} />);
    expect(cancel).toHaveBeenCalledWith(7);
    expect(raf).toHaveBeenCalledTimes(1);
  });

  it("never starts a loop when idle, live, pinned or under reduced motion", () => {
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    render(<CharlotteMark state="idle" reducedMotion={false} />);
    render(<CharlotteMark state="live" reducedMotion={false} />);
    render(<CharlotteMark state="reading" progress={0.5} reducedMotion={false} />);
    render(<CharlotteMark state="reading" reducedMotion />);
    expect(raf).not.toHaveBeenCalled();
  });

  it("shows the finished web, still, under reduced motion", () => {
    const { container } = render(<CharlotteMark state="reading" size={64} reducedMotion />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("wm live");
    expect(spokeCount(svg.querySelector("path.st")!.getAttribute("d")!)).toBe(8);
    expect(svg.querySelectorAll("circle.nd")).toHaveLength(8);
  });

  it("is imported by nothing outside src/design and storybook", () => {
    const readers = sourceFiles("src")
      .filter((path) => /\.(css|tsx?)$/.test(path) && !path.startsWith("src/design/"))
      .filter((path) => /design\/brand\//.test(readFileSync(path, "utf8")));
    expect(readers).toEqual([]);
  });
});
