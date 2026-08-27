import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { analysisPreset } from "@/lib/analysis-presets";
import {
  VERIFY_SOURCE_STEPS,
  VERIFY_THREAD_LABEL,
  checkBadgeText,
  sourcePrompt,
} from "@/lib/verify-thread-shared";
import { marginFlagD } from "@/lib/journey-path";

describe("pass 128 naming", () => {
  it("uses one name for both verification presets", () => {
    expect(VERIFY_THREAD_LABEL).toBe("What to fact check");
    expect(analysisPreset("verification")!.label).toBe(VERIFY_THREAD_LABEL);
    expect(analysisPreset("verification_thread")!.label).toBe(VERIFY_THREAD_LABEL);
  });

  it("keeps the registry ids untouched", () => {
    expect(analysisPreset("verification")!.id).toBe("verification");
    expect(analysisPreset("verification_thread")!.id).toBe("verification_thread");
  });

  it("leaves no literal of the old name in src", () => {
    for (const file of [
      "src/lib/analysis-presets.ts",
      "src/lib/verify-thread-shared.ts",
      "src/components/verify/VerifyThreadReader.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("What to verify");
    }
  });
});

describe("pass 128 copy", () => {
  it("numbers only the claims it was given, verbatim", () => {
    const text = sourcePrompt(["A grew 14%", "B fell"]);
    expect(text).toContain("Claims to check:\n1. A grew 14%\n2. B fell");
    expect(text).toContain("Re-verify each flagged claim below, one at a time.");
    expect(text).not.toContain("—");
  });

  it("spells the three steps exactly", () => {
    expect(VERIFY_SOURCE_STEPS).toEqual([
      "1. Copy the prompt.",
      "2. Run it in the conversation that produced this work.",
      "3. Push the conversation to Lasso again and run this analysis again.",
    ]);
  });

  it("reads the badge as a count of what is left", () => {
    expect(checkBadgeText(3)).toBe("3 TO CHECK");
  });
});

describe("pass 128 ink", () => {
  it("draws a seeded margin flag, the same way every time", () => {
    expect(marginFlagD("a")).toBe(marginFlagD("a"));
    expect(marginFlagD("a")).not.toBe(marginFlagD("b"));
    expect(marginFlagD("a").startsWith("M ")).toBe(true);
  });

  it("never reaches for red", () => {
    for (const file of [
      "src/components/verify/VerifyThreadReader.tsx",
      "src/lib/verify-thread-shared.ts",
      "src/components/notebook/marks.tsx",
    ]) {
      expect(readFileSync(file, "utf8")).not.toContain("--destructive");
    }
  });
});

describe("pass 128 checklist", () => {
  it("skips the 1:1 write when the person checked it themselves", () => {
    const act = readFileSync("src/lib/handoffs-act.server.ts", "utf8");
    expect(act).toContain('if (current.kind === "open_checks" && !selfCheck) {');
    expect(act).toContain('destination: selfCheck ? "none"');
  });

  it("carries settled claims forward for thread runs only", () => {
    const server = readFileSync("src/lib/handoffs.server.ts", "utf8");
    expect(server).toContain("carryForward");
    const run = readFileSync("src/lib/analysis-run.server.ts", "utf8");
    expect(run).toContain('preset.scope === "thread"');
  });
});
