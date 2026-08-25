// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  HANDOFF_AFTER_ARRIVAL_MS,
  HANDOFF_AFTER_SKIP_MS,
  cubicBezier,
  useHandoffScroll,
} from "@/lib/handoff-scroll";
import { TRACED_LEGEND_LINE } from "@/lib/journey";
import { hatchStrokes, wavingSwatchD } from "@/lib/journey-path";
import { WORK_ARTIFACT_INFO, ARTIFACT_SECTION_AREAS } from "@/lib/work-artifact-shared";

afterEach(() => cleanup());

const read = (path: string) => readFileSync(path, "utf8");
const css = read("src/styles.css");
const journeyView = read("src/components/journey/JourneyView.tsx");
const whatFed = read("src/components/engagements/WhatFedThisButton.tsx");
const canvasActions = read("src/components/engagements/CanvasDeliverableActions.tsx");
const sections = read("src/components/journey/WorkArtifactSections.tsx");

describe("A. the yellow legend", () => {
  it("keeps the copy exact", () => {
    expect(TRACED_LEGEND_LINE).toBe(
      "yellow thread = a fact in the finished work, traced back to this conversation",
    );
  });

  it("renders as a figcaption after the spine and before the divider", () => {
    const legend = journeyView.indexOf("nb-traced-legend");
    const spine = journeyView.indexOf("<JourneySpine");
    const divider = journeyView.indexOf("<GraphiteRule");
    expect(spine).toBeGreaterThan(0);
    expect(legend).toBeGreaterThan(spine);
    expect(divider).toBeGreaterThan(legend);
    expect(journeyView).toContain("<figcaption");
    expect(journeyView).toContain("TRACED_LEGEND_LINE");
  });

  it("rests in its final state and only animates on entrance", () => {
    expect(css).toMatch(/\.nb-traced-legend \{[^}]*opacity: 1;/);
    expect(css).toMatch(/\.nb-traced-legend\.is-arriving \{\s*animation: nb-legend-in 400ms ease-out backwards;/);
  });

  it("draws a seeded wavering swatch", () => {
    expect(wavingSwatchD("legend")).toBe(wavingSwatchD("legend"));
    expect(wavingSwatchD("legend")).not.toBe(wavingSwatchD("other"));
  });
});

describe("B. the handoff scroll", () => {
  function setup(reducedMotion = false) {
    const hook = renderHook(() => useHandoffScroll({ reducedMotion }));
    const container = document.createElement("div");
    const target = document.createElement("div");
    Object.defineProperty(target, "offsetTop", { value: 900, configurable: true });
    container.appendChild(target);
    document.body.appendChild(container);
    hook.result.current.containerRef.current = container;
    hook.result.current.targetRef.current = target;
    return { hook, container };
  }

  it("exposes the userHasScrolled flag by name and sets it on a wheel event", () => {
    const { hook } = setup();
    expect(hook.result.current.userHasScrolled.current).toBe(false);
    act(() => {
      window.dispatchEvent(new Event("wheel"));
    });
    expect(hook.result.current.userHasScrolled.current).toBe(true);
  });

  it("skips entirely once the reader has scrolled", async () => {
    const { hook, container } = setup();
    act(() => {
      window.dispatchEvent(new Event("wheel"));
    });
    act(() => hook.result.current.requestHandoff(0));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.scrollTop).toBe(0);
  });

  it("never scrolls under reduced motion", async () => {
    const { hook, container } = setup(true);
    act(() => hook.result.current.requestHandoff(0));
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(container.scrollTop).toBe(0);
  });

  it("uses a rAF loop and animationend, never scrollIntoView or a hardcoded timeout trigger", () => {
    const handoff = read("src/lib/handoff-scroll.ts");
    expect(handoff).toContain("requestAnimationFrame");
    expect(handoff).not.toContain("scrollIntoView");
    expect(journeyView).toContain("onAnimationEnd");
    expect(journeyView).toContain('event.animationName !== "nb-journey-announce"');
    expect(HANDOFF_AFTER_ARRIVAL_MS).toBe(800);
    expect(HANDOFF_AFTER_SKIP_MS).toBe(300);
  });

  it("eases with the spec curve", () => {
    const ease = cubicBezier(0.22, 1, 0.36, 1);
    expect(ease(0)).toBeCloseTo(0, 3);
    expect(ease(1)).toBeCloseTo(1, 3);
    expect(ease(0.5)).toBeGreaterThan(0.5);
  });
});

describe("C. the wide sections layout", () => {
  it("keeps the spine narrow and widens the sections region", () => {
    expect(journeyView).toContain("max-w-[720px]");
    expect(journeyView).toContain("max-w-[1200px]");
    expect(css).toMatch(/\.nb-artifact-region \{\s*padding-inline: 24px;/);
    expect(css).toContain("padding-inline: 32px;");
  });

  it("is exactly two columns at 1024px and up", () => {
    const wide = css.slice(css.indexOf("@media (min-width: 1024px)"));
    expect(wide).toContain("grid-template-columns: repeat(2, 1fr);");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));");
  });

  it("freezes the DOM order and keeps the closing pair on the last row", () => {
    expect(ARTIFACT_SECTION_AREAS).toEqual([
      "usage",
      "prompts",
      "checks",
      "decisions",
      "process",
      "gaps",
    ]);
    expect(css).toContain('"process gaps"');
    const order = ["how", "prompts", "checks", "decisions", "process", "gaps"].map((key) =>
      sections.indexOf(`WORK_ARTIFACT_SECTIONS.${key}`),
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("caps prose inside cards at 65ch", () => {
    expect(css).toContain("max-width: 65ch;");
  });
});

describe("D. the pencil button system", () => {
  it("shares one class and one height across both heroes", () => {
    expect(whatFed).toContain('className="nb-pencil-cta"');
    expect(canvasActions).toContain('className="nb-pencil-cta"');
    expect(css).toMatch(/\.nb-pencil-cta \{[\s\S]*?height: 44px;/);
    expect(css).toMatch(/\.nb-pencil-cta \{[\s\S]*?padding: 0 20px;/);
    expect(css).toMatch(/\.nb-pencil-cta \{[\s\S]*?border: 1\.5px solid var\(--nb-graphite\);/);
  });

  it("has no blue gradient left anywhere", () => {
    expect(css).not.toContain("nb-web-cta");
    expect(css).not.toContain("nb-web-drift");
    expect(css).not.toContain("nb-web-wave");
    expect(css).not.toContain("--nb-web-blue");
  });

  it("breathes in counterphase and freezes at 0.6 under reduced motion", () => {
    expect(css).toContain("animation: nb-hatch-breathe 7s ease-in-out infinite;");
    expect(css).toMatch(/\.nb-hatch-counter \{\s*animation-delay: -3\.5s;/);
    const reduced = css.slice(css.indexOf("@keyframes nb-hatch-breathe"));
    expect(reduced).toContain("opacity: 0.6 !important;");
  });

  it("draws deterministic seeded hatching, 10 to 14 strokes", () => {
    for (const seed of ["cta-web", "cta-artifact"]) {
      const a = hatchStrokes(seed);
      const b = hatchStrokes(seed);
      expect(a).toEqual(b);
      expect(a.length).toBeGreaterThanOrEqual(10);
      expect(a.length).toBeLessThanOrEqual(14);
      for (const stroke of a) {
        expect(stroke.opacity).toBeGreaterThanOrEqual(0.25);
        expect(stroke.opacity).toBeLessThanOrEqual(0.55);
      }
    }
    expect(hatchStrokes("cta-web")).not.toEqual(hatchStrokes("cta-artifact"));
  });

  it("generates the hatching once per seed and never from Math.random", () => {
    const marks = read("src/components/notebook/marks.tsx");
    expect(marks).toContain("useMemo(() => hatchStrokes(seed), [seed])");
    for (const source of [
      read("src/lib/journey-path.ts"),
      read("src/lib/handoff-scroll.ts"),
      marks,
      whatFed,
      canvasActions,
      journeyView,
    ]) {
      expect(source).not.toContain("Math.random(");
    }
  });

  it("carries an info trigger that is never a nested button", () => {
    const trigger = read("src/components/engagements/CtaInfo.tsx");
    expect(trigger).toContain('role="button"');
    expect(trigger).not.toContain("<button");
    expect(whatFed).toContain("CtaInfoTrigger");
    expect(canvasActions).toContain("CtaInfoTrigger");
    expect(WORK_ARTIFACT_INFO).toBe(
      "Opens the story of how this work was made, with the checked facts and the process behind them.",
    );
  });

  it("leaves Ship to firm as the quiet pill without hatching", () => {
    const ship = canvasActions.slice(canvasActions.lastIndexOf("SHIP_ACTION_LABEL"));
    expect(ship).not.toContain("PencilHatch");
  });
});
