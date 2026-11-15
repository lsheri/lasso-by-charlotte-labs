// @vitest-environment jsdom
// Phase 3 PR7 colour sweep (gate R3): names Lasso components read directly now resolve to Charlotte values under the
// skin, and every new hook falls back to today's Lasso value, so Lasso renders unchanged.
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrandLockup, ShellMark } from "@/components/layout/BrandLockup";
import { SkinContext } from "@/components/skin/use-skin";
import { ToolBadge } from "@/design/reference/ToolBadge";
import { kindChipTint } from "@/lib/card-meta";
import type { Skin } from "@/lib/skin";

const css = readFileSync("src/design/skins/charlotte.css", "utf8");

function inSkin(skin: Skin, node: React.ReactElement) {
  return <SkinContext.Provider value={skin}>{node}</SkinContext.Provider>;
}

describe("PR7: Charlotte restates the names Lasso components read directly", () => {
  it("has no orange, no Lasso near-black and no lime on resting surfaces", () => {
    for (const decl of [
      "--state-shared-in:var(--ch-navy);",
      "--state-shared-wash:var(--ch-navy-wash);",
      "--text-on-acid:var(--ch-navy);",
      "--neutral-95:var(--ch-navy);",
      "--ask-mark:var(--ch-navy);",
      "--vendor-claude:var(--ch-muted);",
      "--state-yours-pending:var(--t-words);",
    ]) {
      expect(css).toContain(decl);
    }
  });

  it("moves every drawn-region family and all eight board hues onto Charlotte inks", () => {
    for (const family of ["green", "blue", "rose", "yellow", "lavender", "slate"]) {
      for (const step of ["vivid", "soft", "soft-edge"]) expect(css).toContain(`--nb-region-${family}-${step}:`);
    }
    for (let i = 0; i < 8; i += 1) {
      expect(css).toContain(`--board-hue-${i}-ink:`);
      expect(css).toContain(`--board-hue-${i}-wash:`);
    }
    expect(css).not.toMatch(/--nb-region-[a-z]+-vivid:var\(--ch-lime\)/);
  });

  it("gives every sketch kind a family ink for its label and accent stroke", () => {
    for (const kind of ["chat", "email", "transcript", "doc", "sheet", "deck"]) {
      expect(css).toContain(`[data-sketch-kind="${kind}"]`);
    }
  });
});

describe("PR7 hooks keep Lasso's values when unset", () => {
  it("sketch accent and kind label fall back to the Lasso tokens", () => {
    const sketch = readFileSync("src/design/reference/Sketch.tsx", "utf8");
    const card = readFileSync("src/design/reference/SketchCard.tsx", "utf8");
    expect(sketch.match(/acid: 'var\(--sketch-acid, var\(--hand-live\)\)'/g)).toHaveLength(2);
    expect(card).toContain("'var(--sketch-kind-ink, var(--text-muted))'");
  });

  it("kind chips fall back to the Lasso washes and inks", () => {
    expect(kindChipTint({ deliverable_kind: "deck" }, null)).toEqual({
      background: "var(--kind-chip-deck-bg, #faf1e2)",
      color: "var(--kind-chip-deck-ink, var(--nb-amber))",
    });
  });

  it("the tool tile keeps its tinted inline style and only gains a hook attribute", () => {
    const { container } = render(<ToolBadge tool="claude" size="sm" />);
    const tile = container.firstElementChild as HTMLElement;
    expect(tile.hasAttribute("data-tool-badge")).toBe(true);
    expect(tile.style.background).toContain("color-mix");
  });
});

describe("PR7 brand marks in the signed-in shell", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the C with its lime hub and CHARLOTTE only when skinned and the skin is Charlotte (PR7b)", () => {
    const charlotte = render(inSkin("charlotte", <BrandLockup size="sm" skinned />)).container;
    expect(charlotte.querySelector('[data-skin-mark="charlotte"] svg.wm.live')).not.toBeNull();
    expect(charlotte.textContent).toBe("CHARLOTTE");
    for (const node of [
      inSkin("charlotte", <BrandLockup size="sm" />),
      inSkin("lasso", <BrandLockup size="sm" skinned />),
      <BrandLockup size="sm" skinned />,
    ]) {
      const { container } = render(node);
      expect(container.querySelector("[data-skin-mark]")).toBeNull();
      expect(container.querySelector("svg.text-lasso-green")).not.toBeNull();
      expect(container.textContent).toBe("LASSO");
    }
  });

  it("the board rail mark follows the skin", () => {
    expect(render(inSkin("charlotte", <ShellMark />)).container.querySelector("svg.wm")).not.toBeNull();
    expect(render(inSkin("lasso", <ShellMark />)).container.querySelector("svg.text-lasso-green")).not.toBeNull();
  });
});
