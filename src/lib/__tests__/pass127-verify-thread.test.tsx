import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  ANALYSIS_PRESET_IDS,
  analysisPreset,
  presetsForScope,
} from "@/lib/analysis-presets";
import {
  HANDOFF_PRESETS,
  stripHandoffTail,
  tailInstruction,
  normalizeTurnRef,
} from "@/lib/handoffs-shared";
import {
  VERIFY_THREAD_EMPTY_LINE,
  VERIFY_THREAD_LABEL,
  orderFindings,
  verdictInk,
  verdictPhrase,
  verifyFindings,
  splitByQuote,
} from "@/lib/verify-thread-shared";

const SENTINEL = "LASSO_HANDOFFS_V1";

function payload(items: unknown[]): string {
  return `Answer text.\n\n\`\`\`\n${SENTINEL}\n${JSON.stringify({ open_checks: items })}\n\`\`\``;
}

const claim = {
  claim_quote: "The market grew 14% last year",
  location: "Turn 4",
  verdict: "nothing_visible",
  suggested_check: "Pull the source table.",
};

describe("pass 127 registry", () => {
  it("registers verification_thread as thread scoped and owner only", () => {
    expect(ANALYSIS_PRESET_IDS).toContain("verification_thread");
    const preset = analysisPreset("verification_thread")!;
    expect(preset.scope).toBe("thread");
    expect(preset.coachMayRun).toBe(false);
    expect(preset.label).toBe(VERIFY_THREAD_LABEL);
    expect(preset.handoffSchema).toBe("open_checks");
  });

  it("surfaces it for thread scope, and never for a coach", () => {
    expect(presetsForScope("thread", false).map((p) => p.id)).toContain("verification_thread");
    expect(presetsForScope("thread", true).map((p) => p.id)).not.toContain("verification_thread");
  });

  it("leaves the deliverable scoped verification preset untouched", () => {
    const preset = analysisPreset("verification")!;
    expect(preset.scope).toBe("deliverable");
    expect(HANDOFF_PRESETS["verification"]).toBe("open_checks");
    expect(HANDOFF_PRESETS["verification_thread"]).toBe("open_checks");
  });
});

describe("pass 127 anchoring", () => {
  it("normalises turn references", () => {
    expect(normalizeTurnRef("TURN 4")).toBe("4");
    expect(normalizeTurnRef("turn-04")).toBe("4");
    expect(normalizeTurnRef("no number")).toBeNull();
  });

  it("drops thread findings with no anchor or an unknown anchor", () => {
    const opts = { requireEvidenceTurn: true, allowedTurnRefs: ["4"] };
    expect(stripHandoffTail(payload([claim]), "open_checks", opts).block).toBeNull();
    expect(
      stripHandoffTail(payload([{ ...claim, evidence_turn_id: "9" }]), "open_checks", opts).block,
    ).toBeNull();
    const kept = stripHandoffTail(
      payload([{ ...claim, evidence_turn_id: "TURN 4" }]),
      "open_checks",
      opts,
    );
    expect(kept.block?.items).toHaveLength(1);
  });

  it("drops a finding that points at a human turn (attack pin)", () => {
    // Turn 3 is the person's; only model turns are allowed.
    const opts = { requireEvidenceTurn: true, allowedTurnRefs: ["4"] };
    const result = stripHandoffTail(
      payload([{ ...claim, evidence_turn_id: "3" }]),
      "open_checks",
      opts,
    );
    expect(result.block).toBeNull();
  });

  it("still validates location-only items for the deliverable run", () => {
    const result = stripHandoffTail(payload([claim]), "open_checks");
    expect(result.block?.items).toHaveLength(1);
  });

  it("asks for the turn identifier in the tail instruction", () => {
    expect(tailInstruction("open_checks")).toContain("evidence_turn_id");
  });
});

describe("pass 127 ink and rail", () => {
  it("maps verdicts to existing tokens and never to red", () => {
    // Pass 131: the two open verdicts draw in ember, not amber.
    expect(verdictInk("contradicted")).toEqual({
      stroke: "var(--ember-deep)",
      wash: "var(--ember-wash)",
      dashed: false,
    });
    expect(verdictInk("nothing_visible").stroke).toBe("var(--ember-deep)");
    expect(verdictInk("nothing_visible").dashed).toBe(true);
    expect(verdictInk("checked").stroke).toBe("var(--status-exact)");
    for (const verdict of ["contradicted", "nothing_visible", "checked"]) {
      expect(JSON.stringify(verdictInk(verdict))).not.toContain("destructive");
    }
  });


  it("spells the verdict out so colour is never the only signal", () => {
    expect(verdictPhrase("nothing_visible")).toBe("Nothing visible in the captured record");
  });

  it("orders the rail contradicted, then nothing visible, then checked", () => {
    const make = (verdict: string) => ({ fields: { ...claim, verdict } }) as never;
    const ordered = orderFindings([
      make("checked"),
      make("nothing_visible"),
      make("contradicted"),
    ]);
    expect(ordered.map((f) => (f as { fields: { verdict: string } }).fields.verdict)).toEqual([
      "contradicted",
      "nothing_visible",
      "checked",
    ]);
  });

  it("keeps only anchored, live findings", () => {
    const items = [
      { id: "a", state: "draft", fields: { ...claim, evidence_turn_id: "4" } },
      { id: "b", state: "discarded", fields: { ...claim, evidence_turn_id: "5" } },
      { id: "c", state: "draft", fields: { ...claim } },
    ] as never[];
    expect(verifyFindings(items).map((f) => f.id)).toEqual(["a"]);
  });

  it("marks verbatim spans only", () => {
    expect(splitByQuote("we grew 14% last year", "14%")?.match).toBe("14%");
    expect(splitByQuote("we grew", "not present")).toBeNull();
  });
});

describe("pass 127 copy", () => {
  it("uses the exact empty line", () => {
    expect(VERIFY_THREAD_EMPTY_LINE).toBe(
      "NOTHING HERE NEEDS A CHECK THAT ISN'T ALREADY VISIBLE IN THE RECORD.",
    );
    expect(VERIFY_THREAD_EMPTY_LINE).not.toContain("—");
  });

  it("never makes the person the subject", () => {
    const files = [
      "src/lib/verify-thread-shared.ts",
      "src/components/verify/VerifyThreadReader.tsx",
    ];
    for (const file of files) {
      const text = readFileSync(file, "utf8").toLowerCase();
      for (const banned of ["unchecked", "missed", "gaps"]) {
        expect(text).not.toContain(banned);
      }
      expect(text).not.toContain("--destructive");
    }
  });
});
