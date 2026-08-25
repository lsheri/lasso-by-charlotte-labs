// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ANALYSIS_PRESETS, analysisPreset, presetsForScope } from "@/lib/analysis-presets";
import { driveTypeFromSource, driveWorkType } from "@/lib/connector-toolkits";
import { driveMarkKey } from "@/lib/work-mark";
import { swappedPositions } from "@/lib/workstreams.server";

describe("pass 103 · drive type classification", () => {
  it("reads the original Google mime, not the exported bytes", () => {
    expect(
      driveTypeFromSource({
        sourceMime: "application/vnd.google-apps.presentation",
        storedMime: "application/pdf",
      }),
    ).toBe("deck");
    expect(
      driveTypeFromSource({
        sourceMime: "application/vnd.google-apps.spreadsheet",
        storedMime: "text/csv",
      }),
    ).toBe("sheet");
    expect(
      driveTypeFromSource({
        sourceMime: "application/vnd.google-apps.document",
        storedMime: "text/markdown",
      }),
    ).toBe("document");
  });

  it("falls back to the Drive link path when no Google mime is kept", () => {
    expect(
      driveTypeFromSource({
        webViewLink: "https://docs.google.com/presentation/d/abc/edit",
        storedMime: "application/pdf",
      }),
    ).toBe("deck");
    expect(
      driveTypeFromSource({
        webViewLink: "https://docs.google.com/spreadsheets/d/abc/edit",
        storedMime: "application/pdf",
      }),
    ).toBe("sheet");
  });

  it("leaves native uploads to the existing detection", () => {
    expect(
      driveTypeFromSource({
        storedMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      }),
    ).toBe(driveWorkType("application/vnd.ms-powerpoint"));
    expect(driveTypeFromSource({ storedMime: "application/pdf" })).toBe("document");
  });
});

describe("pass 103 · mark selection", () => {
  it("shows the specific Google app mark when the record evidences it", () => {
    expect(
      driveMarkKey({ meta: { source_mime: "application/vnd.google-apps.presentation" } }),
    ).toBe("googleslides");
    expect(
      driveMarkKey({ meta: { web_view_link: "https://docs.google.com/spreadsheets/d/x/edit" } }),
    ).toBe("googlesheets");
    expect(driveMarkKey({ type: "deck" })).toBe("googleslides");
  });

  it("falls back to the plain Drive mark without evidence", () => {
    expect(driveMarkKey({ type: "document" })).toBe("googledrive");
    expect(driveMarkKey({})).toBe("googledrive");
  });

  it("keeps mark selection in one module", () => {
    const source = readFileSync("src/components/work/SourceMark.tsx", "utf8");
    expect(source).toContain("driveMarkKey");
    expect(source).not.toContain("function driveBrand");
  });
});

describe("pass 103 · workstream ordering", () => {
  const ordered = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
    { id: "c", position: 2 },
  ];

  it("swaps a column with its neighbour", () => {
    expect(swappedPositions(ordered, "b", "left")).toEqual([
      { id: "b", position: 0 },
      { id: "a", position: 1 },
    ]);
    expect(swappedPositions(ordered, "b", "right")).toEqual([
      { id: "b", position: 2 },
      { id: "c", position: 1 },
    ]);
  });

  it("refuses to move past either end", () => {
    expect(swappedPositions(ordered, "a", "left")).toBeNull();
    expect(swappedPositions(ordered, "c", "right")).toBeNull();
    expect(swappedPositions(ordered, "missing", "left")).toBeNull();
  });
});

describe("pass 103 · sticky cards and spider", () => {
  const page = readFileSync("src/pages/EngagementPage.tsx", "utf8");
  const note = readFileSync("src/components/engagements/EngagementNote.tsx", "utf8");
  const styles = readFileSync("src/styles.css", "utf8");
  const spider = readFileSync("src/components/notebook/SpiderMark.tsx", "utf8");

  it("opens both notes from either toggle, on their own paper colours", () => {
    expect(note).toContain("onToggle");
    expect(note).toContain('data-tone={tone}');
    const toggles = page.match(/onToggle=\{\(\) => setNotesOpen\(\(v\) => !v\)\}/g) ?? [];
    expect(toggles).toHaveLength(2);
    expect(page).toContain('tone="blue"');
    expect(page).toContain('tone="green"');
    expect(styles).toContain("--nb-sticky-blue");
    expect(styles).toContain("--nb-sticky-green");
  });

  it("gives the brief card a pencil onto the existing edit flow", () => {
    expect(page).toContain("Edit the brief and details");
    expect(page).toContain("<EditEngagementDialog");
  });

  it("wobbles once on one still frame, and holds still under reduced motion", () => {
    expect(spider).not.toContain("lasso-spider-spin.gif");
    expect(spider).toContain("nb-spider-wobble");
    expect((styles.match(/@keyframes nb-spider-wobble/g) ?? []).length).toBe(1);
    expect(styles).not.toContain(".nb-spider-anim { display: inline-block; }");
    const reduced = styles.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(styles.slice(reduced)).toContain("animation: none !important");
  });

  it("lifts the canvas card title clear of its rule", () => {
    expect(styles).toContain(".nb-canvas-card-title");
    expect(readFileSync("src/components/engagements/EngagementCanvas.tsx", "utf8")).toContain(
      "nb-canvas-card-title",
    );
  });
});

describe("pass 103 · analysis library trim", () => {
  it("drops the two retired presets from every scope", () => {
    for (const scope of ["thread", "deliverable", "engagement"] as const) {
      for (const coach of [true, false]) {
        const ids = presetsForScope(scope, coach).map((p) => p.id);
        expect(ids).not.toContain("what_recurs");
        expect(ids).not.toContain("how_this_was_made");
      }
    }
    expect(analysisPreset("what_recurs")).toBeNull();
    expect(analysisPreset("how_this_was_made")).toBeNull();
  });

  it("keeps the chip order file free of them too", () => {
    const chips = readFileSync("src/components/reflect/ChatAnalyses.tsx", "utf8");
    expect(chips).not.toContain("what_recurs");
    expect(chips).not.toContain("how_this_was_made");
  });

  it("labels working_the_model Prompt Efficiency without changing its id", () => {
    const preset = analysisPreset("working_the_model")!;
    expect(preset.label).toBe("Prompt Efficiency");
    expect(preset.dbPreset).toBe("working_the_model");
  });

  it("writes info copy that matches what each analysis does, with no em dashes", () => {
    for (const preset of ANALYSIS_PRESETS) {
      expect(preset.description).not.toContain("—");
      for (const line of preset.infoPanel.looksFor) expect(line).not.toContain("—");
    }
    expect(analysisPreset("what_fed_this")!.description).toContain("two-pane provenance audit");
    expect(analysisPreset("firm_checks")!.description).toContain("one check at a time");
    expect(analysisPreset("ai_fluency_4d")!.description).toContain("Only you can run it");
  });
});
