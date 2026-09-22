// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ThinkingTrail } from "@/components/reflect/ContextTrail";
import type { ContextManifest } from "@/lib/context-manifest";

const manifest: ContextManifest = {
  engagement: null,
  brief_included: false,
  firm_checks_applied: 0,
  items: [
    { id: "read-1", title: "Interview notes", kind: "note", detail: "420 words" },
    { id: "read-2", title: "Working deck", kind: "deck", detail: "8 slides" },
  ],
  excluded: [{ title: "Private note", reason: "not available for this question" }],
  assembled_at: "2026-09-22T08:00:00.000Z",
};

function setReducedMotion(reduced: boolean) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
}

describe("ThinkingTrail reading state", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setReducedMotion(false);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("keeps the lead and every revealed item pending until a manifest arrives", () => {
    const { container, rerender } = render(
      <ThinkingTrail
        items={[
          { id: "selected-1", title: "Interview notes" },
          { id: "selected-2", title: "Working deck" },
        ]}
        finalPhase="Writing"
      />,
    );

    act(() => vi.advanceTimersByTime(150));
    act(() => vi.advanceTimersByTime(150));

    expect(screen.getByText("Reading the record you chose").closest("p")?.dataset["trailState"]).toBe(
      "pending",
    );
    expect(screen.getByText("Interview notes").closest("p")?.dataset["trailState"]).toBe("pending");
    expect(screen.getByText("Working deck").closest("p")?.dataset["trailState"]).toBe("pending");
    expect(screen.getByText("Writing").closest("p")?.dataset["trailState"]).toBe("pending");
    expect(container.querySelectorAll('[data-trail-state="read"]')).toHaveLength(0);

    rerender(
      <ThinkingTrail
        items={[
          { id: "selected-1", title: "Interview notes" },
          { id: "selected-2", title: "Working deck" },
        ]}
        finalPhase="Writing"
        manifest={null}
      />,
    );
    expect(container.querySelectorAll('[data-trail-state="read"]')).toHaveLength(0);
  });

  it("ticks only lines confirmed by the manifest", () => {
    const { container } = render(
      <ThinkingTrail items={[]} finalPhase="Writing" manifest={manifest} />,
    );

    expect(screen.getByText("Reading the record you chose").closest("p")?.dataset["trailState"]).toBe(
      "read",
    );
    expect(screen.getByText("Interview notes (420 words)").closest("p")?.dataset["trailState"]).toBe(
      "read",
    );
    expect(screen.getByText("Working deck (8 slides)").closest("p")?.dataset["trailState"]).toBe(
      "read",
    );
    expect(screen.getByText("Writing").closest("p")?.dataset["trailState"]).toBe("pending");
    expect(screen.getByText(/Private note:/).closest("p")?.dataset["trailState"]).toBe("excluded");
    expect(screen.getByText(/Private note:/).closest("p")?.querySelector("svg")).toBeNull();
    expect(container.querySelectorAll('[data-trail-state="read"] svg')).toHaveLength(3);
  });

  it("renders fully drawn ticks without animation when motion is reduced", () => {
    setReducedMotion(true);
    const { container } = render(
      <ThinkingTrail items={[]} finalPhase="Writing" manifest={manifest} />,
    );

    const paths = [...container.querySelectorAll('[data-trail-state="read"] path')];
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      const svgPath = path as SVGPathElement;
      expect(svgPath.style.strokeDashoffset).toBe("0");
      expect(svgPath.style.transition).toBe("none");
    }
  });

  it("distributes a twenty-item resolve cascade evenly within the delay cap", () => {
    const manyItems = Array.from({ length: 20 }, (_, index) => ({
      id: `read-${index}`,
      title: `Read ${index}`,
      kind: "item" as const,
      detail: "",
    }));
    const { container } = render(
      <ThinkingTrail
        items={[]}
        finalPhase="Writing"
        manifest={{ ...manifest, items: manyItems, excluded: [] }}
      />,
    );

    const delays = [...container.querySelectorAll('[data-trail-state="read"] path')].map(
      (path) => Number.parseFloat((path as SVGPathElement).style.transitionDelay),
    );
    expect(delays.every((delay, index) => index === 0 || delay > delays[index - 1])).toBe(true);
    expect(new Set(delays).size).toBe(delays.length);
    expect(Math.max(...delays)).toBeLessThanOrEqual(280);
  });
});