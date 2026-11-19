// @vitest-environment jsdom
// Phase 3 PR7 colour sweep (gate R3): names Lasso components read directly now resolve to Charlotte values under the
// skin, and every new hook falls back to today's Lasso value, so Lasso renders unchanged.
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BrandLockup, BrandMark, BrandWordmark } from "@/components/layout/BrandLockup";
import { SkinContext } from "@/components/skin/use-skin";
import { ToolBadge } from "@/design/reference/ToolBadge";
import { kindChipTint } from "@/lib/card-meta";
import type { Skin } from "@/lib/skin";
import { resolvedSkin } from "@/design/skin-tokens";

// 19 Nov: Slate / Spool script (Lasso) is the default look now. This file tests the Charlotte look, which allowed
// accounts can still choose, so it pins the earlier default. The default itself is tested in slate-spool-brand.test.tsx.
vi.mock("@/lib/brand-variant-shared", async (original) => ({
  ...(await original<typeof import("@/lib/brand-variant-shared")>()),
  DEFAULT_BRAND_VARIANT: "current",
}));

function inSkin(skin: Skin, node: React.ReactElement) {
  return <SkinContext.Provider value={skin}>{node}</SkinContext.Provider>;
}

describe("PR7: Charlotte restates the names Lasso components read directly", () => {
  it("has no orange, no Lasso near-black and no lime on resting surfaces", () => {
    // Since G2 (17 Nov) skin-base.css maps these from Charlotte's brand values; check what they resolve to.
    const t = resolvedSkin("charlotte");
    const is = (name: string, from: string) => expect(t.get(name), name).toBe(t.get(from));
    for (const name of ["--state-shared-in", "--text-on-acid", "--neutral-95", "--ask-mark"])
      is(name, "--skin-ink");
    is("--state-shared-wash", "--skin-ink-wash");
    is("--vendor-claude", "--skin-text-2");
    is("--state-yours-pending", "--t-words");
  });

  it("moves every drawn-region family and all eight board hues onto Charlotte inks", () => {
    // Since G2 part 3 (17 Nov) the families come from skin-base.css, built from Charlotte's six type hues.
    const css =
      readFileSync("src/design/skins/charlotte.css", "utf8") +
      readFileSync("src/design/skins/skin-base.css", "utf8");
    for (const family of ["green", "blue", "rose", "yellow", "lavender", "slate"]) {
      for (const step of ["vivid", "soft", "soft-edge"])
        expect(css).toContain(`--nb-region-${family}-${step}:`);
    }
    for (let i = 0; i < 8; i += 1) {
      expect(css).toContain(`--board-hue-${i}-ink:`);
      expect(css).toContain(`--board-hue-${i}-wash:`);
    }
    expect(css).not.toMatch(/--nb-region-[a-z]+-vivid:var\(--skin-live\)/);
    expect(css).not.toMatch(
      /--nb-region-[a-z]+-vivid:var\(--ask-live\)|--nb-region-[a-z]+-vivid:var\(--live\)/,
    );
  });

  it("gives every sketch kind a family ink for its label and accent stroke", () => {
    const base = readFileSync("src/design/skins/skin-base.css", "utf8");
    for (const kind of ["chat", "email", "transcript", "doc", "sheet", "deck"]) {
      expect(base).toContain(`[data-sketch-kind="${kind}"]`);
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
      background: "var(--kind-chip-deck-bg)",
      color: "var(--kind-chip-deck-ink, var(--nb-amber))",
    });
    // Since G11 (17 Nov) Lasso's washes are declared in tokens.css instead of written as fallbacks.
    const tokens = readFileSync("src/design/tokens.css", "utf8");
    expect(tokens).toContain("--kind-chip-deck-bg:#faf1e2;");
    expect(tokens).toContain("--kind-chip-proposal-bg:#e7efe9;");
    expect(tokens).toContain("--kind-chip-numbers-bg:#e8f0fb;");
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

  it("the lockup follows the skin everywhere: the C with its lime hub and CHARLOTTE, or the lime loop and LASSO (Phase 4)", () => {
    const charlotte = render(inSkin("charlotte", <BrandLockup size="sm" />)).container;
    expect(charlotte.querySelector('[data-skin-mark="charlotte"] svg.wm.live')).not.toBeNull();
    expect(charlotte.querySelector("svg.text-lasso-green")).toBeNull();
    expect(charlotte.textContent).toBe("CHARLOTTE");
    for (const node of [inSkin("lasso", <BrandLockup size="sm" />), <BrandLockup size="sm" />]) {
      const { container } = render(node);
      expect(container.querySelector("[data-skin-mark]")).toBeNull();
      expect(container.querySelector("svg.text-lasso-green")).not.toBeNull();
      expect(container.textContent).toBe("LASSO");
    }
  });

  it("the still mark and the wordmark follow the skin", () => {
    expect(
      render(inSkin("charlotte", <BrandMark px={28} />)).container.querySelector("svg.wm"),
    ).not.toBeNull();
    const lasso = render(
      inSkin("lasso", <BrandMark className="h-7 w-7 text-lasso-green" px={28} />),
    ).container;
    expect(lasso.querySelector("svg.text-lasso-green")).not.toBeNull();
    expect(render(inSkin("charlotte", <BrandWordmark />)).container.textContent).toBe("CHARLOTTE");
    expect(render(inSkin("lasso", <BrandWordmark />)).container.textContent).toBe("LASSO");
  });
});
