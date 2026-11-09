// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { fitsIn, scrollAreaOf } from "@/components/reflect/use-ask-lasso";

function boxed(el: HTMLElement, top: number, bottom: number) {
  el.getBoundingClientRect = () =>
    ({
      top,
      bottom,
      left: 0,
      right: 100,
      width: 100,
      height: bottom - top,
      x: 0,
      y: top,
      toJSON() {},
    }) as DOMRect;
}

describe("V2-2d helpers", () => {
  it("finds the nearest ancestor that scrolls vertically", () => {
    const outer = document.createElement("div");
    outer.style.overflowY = "auto";
    const mid = document.createElement("div");
    const leaf = document.createElement("div");
    outer.appendChild(mid);
    mid.appendChild(leaf);
    document.body.appendChild(outer);
    expect(scrollAreaOf(leaf)).toBe(outer);
    outer.remove();
  });
  it("returns null when nothing scrolls", () => {
    const leaf = document.createElement("div");
    document.body.appendChild(leaf);
    expect(scrollAreaOf(leaf)).toBeNull();
    leaf.remove();
  });
  it("a block above the scroll area does not fit; one inside does, with 1 px slack", () => {
    const area = document.createElement("div");
    const block = document.createElement("div");
    boxed(area, 450, 615);
    boxed(block, 385, 503); // the measured miss: 65 px above view
    expect(fitsIn(block, area)).toBe(false);
    boxed(block, 450, 568);
    expect(fitsIn(block, area)).toBe(true);
    boxed(block, 449.5, 615.5);
    expect(fitsIn(block, area)).toBe(true);
  });
});

describe("V2-2d wiring", () => {
  const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
  const effect = hook.slice(
    hook.indexOf("// V2-2d: the panel keeps growing"),
    hook.indexOf("async function ensureSession"),
  );
  it("only while a question is in flight, and only where ResizeObserver exists", () => {
    expect(effect).toMatch(/if \(!pending \|\| typeof ResizeObserver !== "function"\) return;/);
  });
  it("watches the scroll area and the reading block, and stops when the turn ends", () => {
    expect(effect).toMatch(/watch\.observe\(scroller\);/);
    expect(effect).toMatch(/if \(reading\) watch\.observe\(reading\);/);
    expect(effect).toMatch(/return \(\) => watch\.disconnect\(\);/);
  });
  it("re-scrolls the reading block only when it is out of view, never the stream", () => {
    expect(effect).toMatch(
      /if \(reading && !fitsIn\(reading, scroller\)\) reading\.scrollIntoView\(\{ behavior: "auto", block: "nearest" \}\);/,
    );
    expect(effect).not.toMatch(/streamed/);
  });
  it("flag off is unchanged: the reading block only exists under ask-v2", () => {
    expect(effect).toMatch(/data-testid="ask-reading-v2"/);
    expect(hook).not.toMatch(/data-editing|liveBusy/);
  });
});
