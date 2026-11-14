// @vitest-environment jsdom
// Phase 3 PR5: work kinds draw the Charlotte kind glyphs and family colours under Charlotte; Lasso renders as before.
import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KindGlyph } from "@/components/work/KindIcon";
import { SkinContext } from "@/components/skin/use-skin";
import { CHARLOTTE_KINDS } from "@/design/icons/charlotte-kinds";
import { workIdentity } from "@/lib/work-identity";
import type { WorkType } from "@/lib/work-types";

const TYPES: WorkType[] = ["ai_thread", "document", "deck", "sheet", "call", "email", "message", "image"];
const KINDS = [
  "artifact_code",
  "artifact_react",
  "artifact_html",
  "artifact_svg",
  "artifact_mermaid",
  "artifact_markdown",
  "canvas_code",
  "canvas_document",
  "image_description",
  "research_report",
  "page",
  "file",
  "other",
  "something-new",
];
const IDENTITIES = [
  ...TYPES.map((type) => workIdentity({ type })),
  ...KINDS.map((kind) => workIdentity({ type: "document", source_meta: { kind } as never })),
];
const PROPS = { className: "h-4 w-4", style: { color: "var(--hue-sand)" }, "aria-hidden": true } as const;

const css = readFileSync("src/design/skins/charlotte.css", "utf8");
function token(name: string) {
  return css.match(new RegExp(`${name}:([^;]+);`))?.[1]?.trim();
}
function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = c.map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}
function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x! + 0.05) / (y! + 0.05);
}

describe("PR5 work kinds by skin", () => {
  it("renders the same Lucide icon in Lasso, with no provider and with the Lasso skin", () => {
    for (const { icon: Icon, label } of IDENTITIES) {
      const Lucide = Icon.lucide;
      const expected = render(<Lucide {...PROPS} />).container.innerHTML;
      expect(render(<Icon {...PROPS} />).container.innerHTML, label).toBe(expected);
      const lasso = render(
        <SkinContext.Provider value="lasso">
          <Icon {...PROPS} />
        </SkinContext.Provider>,
      ).container.innerHTML;
      expect(lasso, label).toBe(expected);
    }
  });

  it("draws the Charlotte kind glyph under Charlotte, keeping the caller's class, colour and aria-hidden", () => {
    for (const { icon: Icon, label } of IDENTITIES) {
      const { container } = render(
        <SkinContext.Provider value="charlotte">
          <Icon {...PROPS} />
        </SkinContext.Provider>,
      );
      const svg = container.querySelector("svg")!;
      const kind = CHARLOTTE_KINDS.find((k) => k.id === Icon.kind)!;
      expect(svg.getAttribute("data-kind"), label).toBe(kind.id);
      expect(svg.getAttribute("stroke-width")).toBe("1.5");
      expect(svg.getAttribute("stroke")).toBe("currentColor");
      expect(svg.getAttribute("class")).toBe("h-4 w-4");
      expect(svg.getAttribute("aria-hidden")).toBe("true");
      expect(svg.style.color).toBe("var(--hue-sand)");
      expect([...svg.querySelectorAll("path")].map((p) => p.getAttribute("d"))).toEqual(
        kind.d.map((p) => (typeof p === "string" ? p : p.d)),
      );
    }
  });

  it("keeps every kind distinct by its glyph alone (the stop condition)", () => {
    const shapes = CHARLOTTE_KINDS.map((k) => JSON.stringify(k.d));
    expect(new Set(shapes).size).toBe(CHARLOTTE_KINDS.length);
    expect(new Set(CHARLOTTE_KINDS.map((k) => k.id)).size).toBe(12);
  });

  it("gives each family a colour that passes 4.5:1 on every Charlotte surface, and none is lime", () => {
    const surfaces = [token("--ch-page")!, token("--ch-white")!, token("--ch-wash")!];
    for (const family of ["talk", "words", "numbers", "slides", "visual", "code"]) {
      const value = token(`--t-${family}`);
      expect(value, family).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(value!.toLowerCase()).not.toBe(token("--ch-lime")!.toLowerCase());
      for (const s of surfaces) expect(contrast(value!, s), `${family} on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("maps today's kind hues onto families and leaves --hue-neutral alone", () => {
    expect(token("--hue-slate-blue")).toBe("var(--t-talk)");
    expect(token("--hue-sand")).toBe("var(--t-words)");
    expect(token("--hue-sage")).toBe("var(--t-numbers)");
    expect(token("--hue-clay")).toBe("var(--t-slides)");
    expect(token("--hue-amber")).toBe("var(--t-visual)");
    expect(token("--hue-moss")).toBe("var(--t-code)");
    expect(css).not.toMatch(/--hue-neutral:/);
  });

  it("lets KindGlyph accents fall back to today's tokens, which Lasso never overrides", () => {
    const { container } = render(<KindGlyph glyph="deck" />);
    const accent = [...container.querySelectorAll("path")].at(-1)!;
    expect(accent.getAttribute("stroke")).toBe("var(--kind-accent-deck, var(--nb-green))");
    const styles = readFileSync("src/styles.css", "utf8");
    expect(styles).not.toMatch(/--kind-accent-/);
    expect(readFileSync("src/design/tokens.css", "utf8")).not.toMatch(/--kind-accent-/);
  });
});
