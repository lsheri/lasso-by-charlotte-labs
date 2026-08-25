// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";

import { WorkArtifactSections } from "@/components/journey/WorkArtifactSections";
import { ANALYSIS_PRESETS, presetsForScope } from "@/lib/analysis-presets";
import { JOURNEY_TITLE } from "@/lib/journey";
import {
  NO_VERIFICATION_LINE,
  WORK_ARTIFACT_PRESET,
  WORK_ARTIFACT_SECTIONS,
  WORK_ARTIFACT_TITLE,
  artifactSectionDelayMs,
  validateWorkArtifact,
  type ArtifactRecord,
  type WorkArtifact,
} from "@/lib/work-artifact-shared";

afterEach(cleanup);

const record: ArtifactRecord = {
  items: [
    {
      id: "c1",
      text: "TURN 1 USER:\nWrite the margin section using only the audited figures.\n\nTURN 2 ASSISTANT:\nHere is a draft.",
      turns: [{ turn_no: 1 }, { turn_no: 2 }],
    },
    { id: "d1", text: "The margin held at nineteen percent.", turns: [] },
  ],
};

describe("pass 113 · the honesty gate", () => {
  it("drops a fabricated quote and a reference to a turn that does not exist", () => {
    const artifact = validateWorkArtifact(
      {
        example_prompts: [
          {
            quote: "Write the margin section using only the audited figures.",
            why_it_worked: "It named the source the answer had to come from.",
            turn_ref: { item_id: "c1", turn_no: 1 },
          },
          {
            quote: "Please make the deck sing with confidence",
            why_it_worked: "Invented.",
            turn_ref: { item_id: "c1", turn_no: 1 },
          },
          {
            quote: "Write the margin section using only the audited figures.",
            why_it_worked: "Real quote, unreal turn.",
            turn_ref: { item_id: "c1", turn_no: 99 },
          },
        ],
        how_ai_was_used: [
          { stage: "Drafting", what_happened: "The model drafted.", turn_refs: [{ item_id: "c1", turn_no: 2 }] },
          { stage: "Ghost", what_happened: "Never happened.", turn_refs: [{ item_id: "nope", turn_no: 2 }] },
        ],
        honest_gaps: ["The record does not show the review conversation."],
      },
      record,
    );
    expect(artifact.example_prompts).toHaveLength(1);
    expect(artifact.example_prompts[0]!.turn_ref).toEqual({ item_id: "c1", turn_no: 1 });
    expect(artifact.how_ai_was_used.map((s) => s.stage)).toEqual(["Drafting"]);
  });

  it("never repairs, and always leaves a gap line", () => {
    const artifact = validateWorkArtifact({}, record);
    expect(artifact.verification_steps).toEqual([]);
    expect(artifact.honest_gaps.length).toBeGreaterThan(0);
  });
});

function fullArtifact(): WorkArtifact {
  return {
    how_ai_was_used: [
      { stage: "Drafting", what_happened: "The model drafted the margin section.", turn_refs: [{ item_id: "c1", turn_no: 2 }] },
    ],
    example_prompts: [
      {
        quote: "Write the margin section using only the audited figures.",
        why_it_worked: "It named the source the answer had to come from.",
        turn_ref: { item_id: "c1", turn_no: 1 },
      },
    ],
    verification_steps: [],
    decisions: [
      { decision: "Keep the audited figure.", decided_by: "person", turn_refs: [] },
    ],
    process_steps: ["Gather the audited figures.", "Draft against them."],
    honest_gaps: ["The record does not show the review conversation."],
  };
}

describe("pass 113 · the artifact as rendered", () => {
  it("renders every section, with the honest verification line and the gaps last", () => {
    const { container } = render(<WorkArtifactSections artifact={fullArtifact()} />);
    for (const label of Object.values(WORK_ARTIFACT_SECTIONS)) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(NO_VERIFICATION_LINE)).toBeTruthy();
    const sections = [...container.querySelectorAll("[data-section]")];
    expect(sections.at(-1)?.getAttribute("data-section")).toBe(WORK_ARTIFACT_SECTIONS.gaps);
  });

  it("always renders the gaps section when an artifact exists", () => {
    render(
      <WorkArtifactSections
        artifact={{ ...fullArtifact(), honest_gaps: ["Nothing shows how it was checked."] }}
      />,
    );
    expect(screen.getByText("Nothing shows how it was checked.")).toBeTruthy();
  });

  it("carries no person metric vocabulary", () => {
    const { container } = render(<WorkArtifactSections artifact={fullArtifact()} />);
    const text = (container.textContent ?? "").toLowerCase();
    for (const banned of ["efficiency", "score", "rating", "streak", "productiv", "faster"]) {
      expect(text.includes(banned)).toBe(false);
    }
  });

  it("is fully static and undelayed when motion is not wanted", () => {
    const { container } = render(<WorkArtifactSections artifact={fullArtifact()} />);
    const sections = [...container.querySelectorAll(".nb-artifact-section")];
    expect(sections.length).toBe(6);
    for (const section of sections) {
      expect(section.classList.contains("nb-artifact-section-static")).toBe(true);
      expect((section as HTMLElement).style.animationDelay).toBe("");
    }
  });

  it("paces the sections one at a time after the spine", () => {
    const { container } = render(
      <WorkArtifactSections artifact={fullArtifact()} drawing startMs={1000} />,
    );
    const delays = [...container.querySelectorAll(".nb-artifact-section")].map((s) =>
      Number.parseInt((s as HTMLElement).style.animationDelay, 10),
    );
    expect(delays[0]).toBe(1000);
    expect(delays[1]! - delays[0]!).toBeGreaterThanOrEqual(500);
    expect(artifactSectionDelayMs(5, 1000)).toBe(3900);
    expect(delays.at(-1)!).toBeLessThanOrEqual(10_000);
  });
});

describe("pass 113 · the preset is never a chip, the rename is complete", () => {
  it("keeps work_artifact out of every rendered preset list", () => {
    expect(ANALYSIS_PRESETS.map((p) => p.id)).not.toContain(WORK_ARTIFACT_PRESET);
    for (const scope of ["thread", "deliverable", "engagement"] as const) {
      for (const coach of [true, false]) {
        expect(presetsForScope(scope, coach).map((p) => p.id)).not.toContain(WORK_ARTIFACT_PRESET);
      }
    }
    const chips = readFileSync("src/components/reflect/ChatAnalyses.tsx", "utf8");
    expect(chips).not.toContain(WORK_ARTIFACT_PRESET);
  });

  it("says Work Artifact everywhere a person reads it", () => {
    expect(JOURNEY_TITLE).toBe(WORK_ARTIFACT_TITLE);
    const canvas = readFileSync("src/components/engagements/CanvasDeliverableActions.tsx", "utf8");
    expect(canvas).toContain("WORK_ARTIFACT_TITLE");
    expect(canvas).toContain("ChaliceMark");
    const peek = readFileSync("src/components/peek/PeekPanel.tsx", "utf8");
    expect(peek).toContain("Work Artifact");
    expect(peek).not.toMatch(/>\s*Journey\s*</);
    const view = readFileSync("src/components/journey/JourneyView.tsx", "utf8");
    expect(view).not.toContain("Close the journey");
  });

  it("refuses a thin record before spending anything, and only the owner may run", () => {
    const server = readFileSync("src/lib/work-artifact.server.ts", "utf8");
    const thinIndex = server.indexOf("JOURNEY_THIN_LINE");
    const callIndex = server.indexOf("chatComplete");
    expect(thinIndex).toBeGreaterThan(-1);
    expect(thinIndex).toBeLessThan(callIndex);
    expect(server).toContain('anchor.owner_id !== profile.id');
    expect(server).toContain('profile.role === "coach"');
  });

  it("runs only through the confirm dialog", () => {
    const panel = readFileSync("src/components/journey/WorkArtifactPanel.tsx", "utf8");
    expect(panel).toContain("AnalysisConfirm");
    // The one mutate call is inside the confirm handler, never on the button.
    expect(panel.match(/build\.mutate\(\)/g) ?? []).toHaveLength(1);
    expect(panel).toContain("onConfirm={() => {");
  });
});
