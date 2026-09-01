import { describe, expect, it, vi } from "vitest";

import {
  declarationOf,
  guessArtifactDeclaration,
  guessWorkflowDeclaration,
  parseArtifactDeclaration,
  parseCoachOutcome,
  parseWorkflowDeclaration,
  COACH_OUTCOME_HINT,
  COACH_OUTCOME_TITLE,
  DECLARE_ARTIFACT_HINT,
  DECLARE_ARTIFACT_TITLE,
  DECLARE_WORKFLOW_HINT,
  DECLARE_WORKFLOW_TITLE,
  RUBRIC_LABEL,
} from "@/lib/declared-work";

const recorded: { eventType: string; dims: unknown }[] = [];
vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: async (_client: unknown, args: { eventType: string; dims: unknown }) => {
    recorded.push({ eventType: args.eventType, dims: args.dims });
  },
}));

const { noteArtifactDeclared, noteWorkflowDeclared, noteCoachOutcome } = await import(
  "@/lib/declared-work.server"
);

const actor = { orgId: "org-1", userId: "user-1", profileId: "profile-1" };
const client = {} as never;

describe("pass 150 closed vocabularies", () => {
  it("rejects values outside the artifact vocabulary", () => {
    expect(() =>
      parseArtifactDeclaration({
        output_kind: "slidedeck",
        disposition: "shipped",
        ai_involvement: "none",
      }),
    ).toThrow();
    expect(() =>
      parseArtifactDeclaration({
        output_kind: "deck",
        disposition: "sent",
        ai_involvement: "none",
      }),
    ).toThrow();
    expect(() =>
      parseArtifactDeclaration({
        output_kind: "deck",
        disposition: "shipped",
        ai_involvement: "wrote it all",
      }),
    ).toThrow();
  });

  it("rejects values outside the workflow and coach vocabularies", () => {
    expect(() =>
      parseWorkflowDeclaration({ process_steps: ["scope", "ponder"], task_class: "draft" }),
    ).toThrow();
    expect(() => parseWorkflowDeclaration({ process_steps: [], task_class: "draft" })).toThrow();
    expect(() =>
      parseWorkflowDeclaration({ process_steps: ["scope"], task_class: "vibe" }),
    ).toThrow();
    expect(() =>
      parseCoachOutcome({ verdict: "maybe", rubric_band: 3, rework_needed: false }),
    ).toThrow();
    expect(() =>
      parseCoachOutcome({ verdict: "accept", rubric_band: 9, rework_needed: false }),
    ).toThrow();
  });

  it("accepts and normalizes good input", () => {
    expect(
      parseWorkflowDeclaration({
        process_steps: ["draft", "draft", "scope"],
        task_class: "analyse",
      }).process_steps,
    ).toEqual(["scope", "draft"]);
    expect(parseCoachOutcome({ verdict: "rework", rubric_band: 2, rework_needed: true })).toEqual({
      verdict: "rework",
      rubric_band: 2,
      rework_needed: true,
    });
  });
});

describe("pass 150 emitters", () => {
  it("emits the three declared events with closed-vocab dims", async () => {
    recorded.length = 0;
    await noteArtifactDeclared(client, actor, {
      output_kind: "deck",
      disposition: "shipped",
      ai_involvement: "refined",
    });
    await noteWorkflowDeclared(client, actor, {
      process_steps: ["scope", "draft"],
      task_class: "draft",
    });
    await noteCoachOutcome(client, actor, {
      verdict: "accept",
      rubric_band: 4,
      rework_needed: false,
    });

    expect(recorded.map((r) => r.eventType)).toEqual([
      "artifact.declared",
      "workflow.declared",
      "coach.outcome",
    ]);
    expect(recorded[0]?.dims).toEqual({
      output_kind: "deck",
      disposition: "shipped",
      ai_involvement: "refined",
    });
  });

  it("refuses invalid values before anything is recorded", async () => {
    recorded.length = 0;
    await expect(
      noteArtifactDeclared(client, actor, { output_kind: "poster" }),
    ).rejects.toThrow();
    await expect(noteCoachOutcome(client, actor, { verdict: "nope" })).rejects.toThrow();
    expect(recorded).toHaveLength(0);
  });
});

describe("pass 150 prefill and card chips", () => {
  it("pre-fills every field so the common case is one click", () => {
    const guess = guessArtifactDeclaration({ type: "deck", title: "Q3 board deck.pptx" });
    expect(guess.output_kind).toBe("deck");
    expect(guess.disposition).toBeTruthy();
    expect(guess.ai_involvement).toBeTruthy();
    const flow = guessWorkflowDeclaration({ type: "deck", title: "Q3 board deck" });
    expect(flow.process_steps.length).toBeGreaterThan(0);
    expect(flow.task_class).toBeTruthy();
  });

  it("reads a declaration back off the item so the card can wear it", () => {
    expect(declarationOf(null)).toBeNull();
    expect(
      declarationOf({
        declared: { output_kind: "memo", disposition: "reworked", ai_involvement: "none" },
      }),
    ).toEqual({ output_kind: "memo", disposition: "reworked", ai_involvement: "none" });
  });
});

describe("pass 150 language laws", () => {
  it("keeps the copy plain", () => {
    const copy = [
      DECLARE_ARTIFACT_TITLE,
      DECLARE_ARTIFACT_HINT,
      DECLARE_WORKFLOW_TITLE,
      DECLARE_WORKFLOW_HINT,
      COACH_OUTCOME_TITLE,
      COACH_OUTCOME_HINT,
      RUBRIC_LABEL,
    ].join(" ");
    for (const banned of [
      "telemetry",
      "analytics",
      "data collection",
      "score",
      "monitor",
      "track",
      "—",
    ]) {
      expect(copy.toLowerCase()).not.toContain(banned);
    }
  });
});
