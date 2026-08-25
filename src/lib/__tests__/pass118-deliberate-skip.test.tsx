// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

import { JourneySpine } from "@/components/journey/JourneyView";
import { buildJourney, type JourneyItemInput } from "@/lib/journey";

const journeyView = readFileSync("src/components/journey/JourneyView.tsx", "utf8");

function item(over: Partial<JourneyItemInput> & { id: string }): JourneyItemInput {
  return {
    title: `Item ${over.id}`,
    type: "doc",
    captured_at: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function journeyOf(ids: string[]) {
  return buildJourney({
    anchorId: "d",
    items: [
      ...ids.map((id, i) => item({ id, type: i === 1 ? "ai_thread" : "doc", turn_count: 5 })),
      item({ id: "d", type: "deck", title: "Board deck", work_date: "2026-03-01" }),
    ],
    order: Object.fromEntries(ids.map((id, i) => [id, i + 1])),
    stitches: [],
  });
}

const delays = (container: HTMLElement) =>
  [...container.querySelectorAll<SVGPathElement>(".nb-journey-seg")].map(
    (node) => node.style.animationDelay,
  );

describe("Pass 118: the story plays in full on every open", () => {
  it("binds no global click or key listener that completes the beats", () => {
    expect(journeyView).not.toContain('window.addEventListener("click"');
    expect(journeyView).not.toContain('window.addEventListener("keydown"');
  });

  it("starts fresh with animation delays on every mount", () => {
    const journey = journeyOf(["a", "b", "c"]);
    for (let pass = 0; pass < 2; pass += 1) {
      const { container, unmount } = render(
        <JourneySpine journey={journey} animate width={640} />,
      );
      const root = container.querySelector(".nb-journey");
      expect(root?.classList.contains("is-skipped")).toBe(false);
      const seen = delays(container);
      expect(seen.length).toBeGreaterThan(0);
      expect(seen.every((d) => d !== "")).toBe(true);
      unmount();
    }
  });

  it("does not complete the story when the reader clicks the spine or the background", () => {
    const { container } = render(<JourneySpine journey={journeyOf(["a", "b", "c"])} animate width={640} />);
    const before = delays(container);
    fireEvent.click(screen.getByTestId("journey-spine"));
    fireEvent.click(document.body);
    fireEvent.keyDown(document.body, { key: "a" });
    expect(container.querySelector(".nb-journey")?.classList.contains("is-skipped")).toBe(false);
    expect(delays(container)).toEqual(before);
  });

  it("completes the story only when the skip button is pressed", () => {
    const onSkip = vi.fn();
    const { container } = render(
      <JourneySpine journey={journeyOf(["a", "b", "c"])} animate width={640} onSkip={onSkip} />,
    );
    fireEvent.click(screen.getByTestId("journey-skip"));
    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".nb-journey")?.classList.contains("is-skipped")).toBe(true);
    expect(screen.queryByTestId("journey-skip")).toBeNull();
  });

  it("offers no skip affordance under reduced motion", () => {
    render(<JourneySpine journey={journeyOf(["a", "b", "c"])} animate={false} width={640} />);
    expect(screen.queryByTestId("journey-skip")).toBeNull();
  });

  it("puts the overlay skip button before Copy link and hides it once the story is over", () => {
    const skip = journeyView.indexOf('data-testid="journey-skip"');
    const copy = journeyView.indexOf("Copy link");
    expect(skip).toBeGreaterThan(0);
    expect(skip).toBeLessThan(copy);
    expect(journeyView).toContain("Skip the story");
    expect(journeyView).toContain("storyPlaying");
    expect(journeyView).toContain("setStoryOver(true)");
    expect(journeyView).not.toContain("sessionStorage");
    expect(journeyView).not.toContain("localStorage");
  });
});
