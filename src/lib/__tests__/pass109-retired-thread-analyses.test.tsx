import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  ANALYSIS_PRESETS,
  ANALYSIS_PRESET_IDS,
  analysisPreset,
  presetsForScope,
} from "@/lib/analysis-presets";
import { NO_HANDOFF_PRESETS, PERSON_SHAPED_PRESETS } from "@/lib/handoffs-shared";

const RETIRED = ["ai_fluency_4d", "working_the_model"] as const;

describe("pass 109 · the two thread analyses are gone from view", () => {
  it("leaves exactly five presets, all deliverable scoped", () => {
    expect(ANALYSIS_PRESETS).toHaveLength(5);
    expect(ANALYSIS_PRESETS.map((p) => p.scope)).toEqual(Array(5).fill("deliverable"));
    expect([...ANALYSIS_PRESET_IDS].sort()).toEqual(
      ["decision_origin", "firm_checks", "still_on_brief", "verification", "what_fed_this"].sort(),
    );
  });

  it("never renders either retired preset as a runnable chip in any scope", () => {
    for (const scope of ["thread", "deliverable", "engagement"] as const) {
      for (const coach of [true, false]) {
        const ids = presetsForScope(scope, coach).map((p) => p.id);
        for (const id of RETIRED) expect(ids).not.toContain(id);
      }
    }
    expect(presetsForScope("thread", false)).toHaveLength(0);
    for (const id of RETIRED) expect(analysisPreset(id)).toBeNull();
  });

  it("keeps coach gating on the survivors unchanged", () => {
    expect(presetsForScope("deliverable", true).map((p) => p.id)).toEqual(
      presetsForScope("deliverable", false).map((p) => p.id),
    );
  });

  it("keeps the chip order and labels free of both", () => {
    const chips = readFileSync("src/components/reflect/ChatAnalyses.tsx", "utf8");
    for (const id of RETIRED) expect(chips).not.toContain(id);
    expect(chips).not.toContain("How you direct AI");
    expect(chips).not.toContain("Prompt Efficiency");
  });

  it("tolerates historical run rows carrying the retired ids", () => {
    // Unknown preset ids resolve to null rather than throwing, so a stored run
    // still renders read only.
    for (const id of RETIRED) expect(() => analysisPreset(id)).not.toThrow();
    expect(PERSON_SHAPED_PRESETS).toEqual([...RETIRED]);
    for (const id of RETIRED) expect(NO_HANDOFF_PRESETS).toContain(id);
  });

  it("drops the now dead technique library module", () => {
    expect(() => readFileSync("src/lib/analysis-library.ts", "utf8")).toThrow();
  });
});
