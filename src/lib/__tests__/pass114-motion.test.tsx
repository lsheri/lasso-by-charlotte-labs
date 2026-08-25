// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

import { JourneySpine } from "@/components/journey/JourneyView";
import { WorkArtifactSections } from "@/components/journey/WorkArtifactSections";
import { fireworkStrokes } from "@/components/notebook/marks";
import { buildJourney, type JourneyItemInput } from "@/lib/journey";
import {
  buildJourneyPath,
  fnv1a,
  mulberry32,
  nodeBeatS,
  nodeStepS,
  sectionsStartS,
  seededRand,
} from "@/lib/journey-path";
import {
  ARTIFACT_SECTION_AREAS,
  WORK_ARTIFACT_SECTIONS,
  artifactSectionDelayMs,
  type WorkArtifact,
} from "@/lib/work-artifact-shared";

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
    stitches: [
      {
        id: "s1",
        status: "exact",
        quote: "the margin held at nineteen percent",
        to_item_id: ids[1] as string,
        to_turn_no: 4,
        created_at: "2026-01-06T00:00:00.000Z",
      },
    ],
  });
}

function artifact(): WorkArtifact {
  return {
    how_ai_was_used: [{ stage: "Drafting", what_happened: "The draft came back.", turn_refs: [] }],
    example_prompts: [{ quote: "Use the audited figures.", why_it_worked: "It named a source.", turn_ref: null }],
    verification_steps: [],
    decisions: [{ decision: "Keep the audited figure.", decided_by: "person", turn_refs: [] }],
    process_steps: ["Gather the figures."],
    honest_gaps: ["The record does not show the review conversation."],
  };
}

describe("pass 114 · determinism", () => {
  it("hashes and draws the same way every time", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
    expect(mulberry32(7)()).toBe(mulberry32(7)());
    const rand = seededRand(["a", "b"]);
    expect(rand(0)).toBe(seededRand(["a", "b"])(0));
    expect(rand(0)).toBeGreaterThanOrEqual(0);
    expect(rand(0)).toBeLessThan(1);
  });

  it("produces byte identical path data for the same record", () => {
    const one = buildJourneyPath({ ids: ["a", "b", "c", "d"], width: 640 });
    const two = buildJourneyPath({ ids: ["a", "b", "c", "d"], width: 640 });
    expect(one.segments.map((s) => s.stroke.d)).toEqual(two.segments.map((s) => s.stroke.d));
    expect(one.nodes).toEqual(two.nodes);
    const other = buildJourneyPath({ ids: ["a", "b", "c", "z"], width: 640 });
    expect(other.segments.map((s) => s.stroke.d)).not.toEqual(one.segments.map((s) => s.stroke.d));
  });

  it("returns a real length for every wavered stroke and never hardcodes one", () => {
    const path = buildJourneyPath({ ids: ["a", "b", "c"], width: 640 });
    for (const segment of path.segments) {
      expect(segment.stroke.length).toBeGreaterThan(100);
      expect(segment.arrow.length).toBe(2);
      for (const arrow of segment.arrow) expect(arrow.length).toBeGreaterThan(5);
    }
  });

  it("alternates lanes and degrades to a narrower path on a small screen", () => {
    const wide = buildJourneyPath({ ids: ["a", "b", "c"], width: 640 });
    const [first, second] = wide.nodes;
    expect(Math.abs((first?.x ?? 0) - (second?.x ?? 0))).toBeGreaterThan(200);
    const narrow = buildJourneyPath({ ids: ["a", "b", "c"], width: 400 });
    const spread = Math.abs((narrow.nodes[0]?.x ?? 0) - (narrow.nodes[1]?.x ?? 0));
    expect(spread).toBeLessThan(140);
    expect(spread).toBeGreaterThan(0);
  });
});

describe("pass 114 · the timeline is one pure function", () => {
  it("spaces node beats and starts the sections after the last arrival", () => {
    expect(nodeStepS(4)).toBe(2.6);
    expect(nodeStepS(7)).toBe(2.0);
    expect(nodeBeatS(0, 4)).toBeCloseTo(0.9);
    expect(nodeBeatS(3, 4)).toBeCloseTo(0.9 + 3 * 2.6);
    expect(sectionsStartS(4)).toBeCloseTo(nodeBeatS(3, 4) + 1.4);
    expect(sectionsStartS(8)).toBeLessThan(nodeBeatS(7, 8) + 1.5);
    expect(nodeBeatS(7, 8)).toBeCloseTo(0.9 + 7 * 2.0);
  });

  it("paces the six sections left to right, then down, then the closing pair", () => {
    expect(artifactSectionDelayMs(0, 1000)).toBe(1000);
    expect(artifactSectionDelayMs(2, 1000)).toBe(1500);
    expect(artifactSectionDelayMs(1, 1000)).toBe(2000);
    expect(artifactSectionDelayMs(5, 1000)).toBe(3900);
  });
});

describe("pass 114 · the spine as rendered", () => {
  it("keeps DOM order equal to record order and draws an arrow into each arrival", () => {
    const journey = journeyOf(["a", "b", "c"]);
    const { container } = render(<JourneySpine journey={journey} animate={false} width={640} />);
    const items = [...container.querySelectorAll(".nb-journey-item")];
    expect(items.length).toBe(journey.nodes.length);
    expect(container.querySelectorAll(".nb-journey-seg").length).toBe(journey.nodes.length - 1);
    expect(container.querySelectorAll(".nb-journey-arrow").length).toBe(
      (journey.nodes.length - 1) * 2,
    );
    expect(screen.getByText("Board deck")).toBeTruthy();
    expect(screen.getByText(/the margin held at nineteen percent/)).toBeTruthy();
  });

  it("renders the same DOM order at a narrow width", () => {
    const journey = journeyOf(["a", "b", "c"]);
    const titles = (width: number) => {
      const { container, unmount } = render(
        <JourneySpine journey={journey} animate={false} width={width} />,
      );
      const found = [...container.querySelectorAll(".nb-journey-item")].map(
        (node) => node.textContent?.slice(0, 24) ?? "",
      );
      unmount();
      return found;
    };
    expect(titles(400)).toEqual(titles(700));
  });

  it("lands on the final state with nothing pending when motion is skipped", () => {
    const { container } = render(
      <JourneySpine journey={journeyOf(["a", "b", "c"])} animate={false} width={640} />,
    );
    const root = container.querySelector(".nb-journey");
    expect(root?.classList.contains("is-skipped")).toBe(true);
    for (const node of container.querySelectorAll(".nb-journey-node")) {
      expect(node.classList.contains("nb-journey-node-static")).toBe(true);
      expect((node as HTMLElement).style.animationDelay).toBe("");
    }
    for (const stroke of container.querySelectorAll(".nb-journey-seg, .nb-journey-arrow")) {
      expect((stroke as SVGElement).getAttribute("style")).toBeNull();
    }
  });

  it("gives the firework a base state of nothing at all", () => {
    const { container } = render(
      <JourneySpine journey={journeyOf(["a", "b", "c"])} animate={false} width={640} />,
    );
    const fireworks = [...container.querySelectorAll(".nb-firework")];
    expect(fireworks.length).toBeGreaterThan(0);
    for (const firework of fireworks) {
      expect((firework as SVGElement).getAttribute("style")).toBeNull();
    }
  });

  it("draws a deterministic burst of seven strokes and two dots", () => {
    const burst = fireworkStrokes("node-1");
    expect(burst.strokes.length).toBe(7);
    expect(burst.dots.length).toBe(2);
    expect(burst.strokes.filter((s) => s.ink === "yellow").length).toBe(4);
    expect(burst.strokes.map((s) => s.d)).toEqual(fireworkStrokes("node-1").strokes.map((s) => s.d));
    expect(burst.strokes[0]?.d).not.toBe(fireworkStrokes("node-2").strokes[0]?.d);
  });

  it("draws no path at all when the record refuses", () => {
    const { container } = render(
      <JourneySpine journey={{ enough: false, nodes: [] }} animate={false} />,
    );
    expect(container.querySelector("svg")).toBeNull();
  });

  it("carries no person metric vocabulary", () => {
    const { container } = render(
      <JourneySpine journey={journeyOf(["a", "b", "c"])} animate={false} width={640} />,
    );
    const text = (container.textContent ?? "").toLowerCase();
    for (const banned of ["prompt", "efficiency", "score", "rating", "streak", "productiv"]) {
      expect(text.includes(banned)).toBe(false);
    }
    expect((container.textContent ?? "").includes("—")).toBe(false);
  });
});

describe("pass 114 · the sections grid", () => {
  it("keeps list order in the DOM and closes with process beside gaps", () => {
    const { container } = render(<WorkArtifactSections artifact={artifact()} />);
    const sections = [...container.querySelectorAll("[data-section]")];
    expect(sections.map((s) => s.getAttribute("data-area"))).toEqual([
      ...ARTIFACT_SECTION_AREAS,
    ]);
    expect(sections.at(-1)?.getAttribute("data-section")).toBe(WORK_ARTIFACT_SECTIONS.gaps);
    expect(sections.at(-2)?.getAttribute("data-area")).toBe("process");
    expect(container.querySelector(".nb-artifact-grid")).toBeTruthy();
    expect(container.querySelector(".nb-a-gaps")).toBeTruthy();
  });
});
