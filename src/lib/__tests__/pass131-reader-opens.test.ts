import { beforeEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  closeVerifyThread,
  currentVerifyThread,
  failVerifyThread,
  openVerifyThread,
  openVerifyThreadPending,
  resolveVerifyThread,
} from "@/components/verify/verify-thread-state";
import {
  VERIFY_CHECK_LABEL,
  VERIFY_WORKING_LINE,
  verdictInk,
  verifyPhaseLines,
} from "@/lib/verify-thread-shared";
import { decisionsPhaseLines } from "@/lib/decisions-thread-shared";

const READER = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");
const LAUNCHER = readFileSync("src/components/verify/ThreadAnalysisLauncher.tsx", "utf8");
const WORK = readFileSync("src/pages/WorkPage.tsx", "utf8");
const ENGAGEMENT = readFileSync("src/pages/EngagementPage.tsx", "utf8");
const STYLES = readFileSync("src/styles.css", "utf8");

describe("pass 131 launch path", () => {
  it("launches thread analyses without the lens", () => {
    expect(LAUNCHER).toContain("AnalysisConfirm");
    expect(LAUNCHER).not.toContain("AnalysisLens");
    expect(LAUNCHER).toContain("openVerifyThreadPending");
    expect(LAUNCHER).toContain('"/api/analysis/stream"');
    expect(LAUNCHER).toContain('confirm_step: "shown"');
  });

  it("routes only the two thread presets away from the lens", () => {
    for (const page of [WORK, ENGAGEMENT]) {
      expect(page).toContain("isThreadReaderPreset(preset)");
      expect(page).toContain("ThreadAnalysisLauncher");
      // Deliverable presets still open the lens exactly as before.
      expect(page).toContain("setLensPreset(preset)");
      expect(page).toContain("<AnalysisLens");
    }
  });
});

describe("pass 131 store", () => {
  beforeEach(() => closeVerifyThread());

  it("opens pending, then resolves once", () => {
    openVerifyThreadPending({ itemId: "i1", itemTitle: "A thread", kind: "verification" });
    expect(currentVerifyThread()).toEqual({
      itemId: "i1",
      itemTitle: "A thread",
      kind: "verification",
      runId: null,
      error: null,
    });
    resolveVerifyThread("run-1");
    expect(currentVerifyThread()?.runId).toBe("run-1");
    // A second resolve cannot overwrite a settled run: singleton, one shot.
    resolveVerifyThread("run-2");
    expect(currentVerifyThread()?.runId).toBe("run-1");
  });

  it("says so when the run fails, and keeps the reader open", () => {
    openVerifyThreadPending({ itemId: "i2", itemTitle: "Another", kind: "decisions" });
    failVerifyThread("The model timed out.");
    expect(currentVerifyThread()?.error).toBe("The model timed out.");
    expect(currentVerifyThread()?.runId).toBe(null);
  });

  it("keeps the existing runId opener working", () => {
    openVerifyThread({ runId: "run-9", itemId: "i1", itemTitle: "A thread" });
    // Resolve and fail are no-ops on a run that already landed.
    resolveVerifyThread("run-x");
    failVerifyThread("nope");
    expect(currentVerifyThread()?.runId).toBe("run-9");
    expect(currentVerifyThread()?.error ?? null).toBe(null);
  });
});

describe("pass 131 phase copy", () => {
  it("spells the verification lines exactly", () => {
    expect(verifyPhaseLines(7)).toEqual([
      "Reading 7 turns",
      "Looking over the facts each turn claims",
      "Checking whether facts got confirmed later in the conversation",
      "Marking what deserves a check at the source",
    ]);
  });

  it("spells the decisions lines exactly", () => {
    expect(decisionsPhaseLines(3)).toEqual([
      "Reading 3 turns",
      "Tracing every call that shaped the work",
      "Sorting what you brought from what the model introduced",
      "Marking the calls to confirm",
    ]);
  });

  it("holds the last line instead of looping the copy", () => {
    expect(READER).toContain("prev + 1 < lines.length ? prev + 1 : prev");
  });

  it("stops the motion on a skip without cancelling the run", () => {
    expect(VERIFY_WORKING_LINE).toBe("Working…");
    expect(READER).toContain("setSkipped(true)");
    expect(READER).not.toContain("abortRun");
  });
});

describe("pass 131 rail", () => {
  it("toggles between the two widths and remembers the choice", () => {
    expect(READER).toContain('"lasso.reader.rail_wide"');
    expect(STYLES).toContain('.nb-reader-grid[data-rail-wide="true"]');
    expect(STYLES).toContain("minmax(0, 1fr) 520px");
    expect(STYLES).toContain("minmax(0, 1fr) 340px");
  });

  it("hides the toggle in the stacked layout", () => {
    const stacked = STYLES.slice(STYLES.indexOf("@media (max-width: 900px)"));
    expect(stacked).toContain(".nb-rail-widen");
  });
});

describe("pass 131 ember ink", () => {
  it("draws the two open verdicts in ember, never amber", () => {
    expect(verdictInk("contradicted").stroke).toBe("var(--ember-deep)");
    expect(verdictInk("nothing_visible").stroke).toBe("var(--ember-deep)");
    expect(verdictInk("nothing_visible").dashed).toBe(true);
    expect(verdictInk("checked").stroke).toBe("var(--status-exact)");
    const shared = readFileSync("src/lib/verify-thread-shared.ts", "utf8");
    expect(shared).not.toContain("--status-paraphrase");
  });

  it("keeps the destructive ban in both readers", () => {
    for (const text of [READER, readFileSync("src/lib/verify-thread-shared.ts", "utf8")]) {
      expect(text).not.toContain("--destructive");
      expect(text).not.toContain("bg-destructive");
    }
  });

  it("leaves the decisions reader in graphite and yellow", () => {
    const decisions = readFileSync("src/lib/decisions-thread-shared.ts", "utf8");
    expect(decisions).not.toContain("ember");
    expect(READER).toContain("var(--nb-ink-yellow)");
  });
});

describe("pass 131 label", () => {
  it("names the suggested check on the rail", () => {
    expect(VERIFY_CHECK_LABEL).toBe("THE CHECK TO RUN");
    expect(READER).toContain("VERIFY_CHECK_LABEL");
  });
});
