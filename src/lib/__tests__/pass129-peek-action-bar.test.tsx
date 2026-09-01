// @vitest-environment jsdom
import { render, screen, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PeekActionBar } from "@/components/peek/PeekActionBar";
import { analysisPreset } from "@/lib/analysis-presets";
import { DELETE_CONSEQUENCE_LINE } from "@/components/work/DeleteWorkItemDialog";
import { REMOVE_CONSEQUENCE_LINE } from "@/components/work/RemoveFromEngagementDialog";
import { readingTrailD } from "@/lib/journey-path";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/decisions/DraftDecisionsButton", () => ({
  useDraftDecisions: () => ({ busy: false, draft: vi.fn() }),
}));

afterEach(cleanup);

const BAR_SRC = readFileSync("src/components/peek/PeekActionBar.tsx", "utf8");
const PEEK_SRC = readFileSync("src/components/peek/PeekPanel.tsx", "utf8");
const READER_SRC = readFileSync("src/components/verify/VerifyThreadReader.tsx", "utf8");
const WORK_SRC = readFileSync("src/pages/WorkPage.tsx", "utf8");
const ENGAGEMENT_SRC = readFileSync("src/pages/EngagementPage.tsx", "utf8");

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "w1",
    title: "A conversation",
    type: "ai_thread",
    source: "mcp:claude",
    visibility: "unmapped",
    owner_id: "p1",
    captured_at: "2026-01-01T00:00:00Z",
    content_ref: null,
    created_at_source: null,
    work_date: null,
    content_fidelity: "transcribed",
    source_vendor: "claude",
    orig_conversation_id: null,
    source_meta: null,
    meta: null,
    work_item_tasks: [],
    ...overrides,
  } as WorkItemRow;
}

function bar(props: Partial<React.ComponentProps<typeof PeekActionBar>> = {}) {
  return render(
    <PeekActionBar
      item={item()}
      canEdit
      owned
      onMap={vi.fn()}
      onWorkDate={vi.fn()}
      onMakePrivate={vi.fn()}
      onAnalyse={vi.fn()}
      onShip={vi.fn()}
      onBrief={vi.fn()}
      onRemove={vi.fn()}
      onDelete={vi.fn()}
      {...props}
    />,
  );
}

describe("pass 129 — the peek action bar", () => {
  it("renders the primary row in a fixed order", () => {
    bar({ item: item({ type: "document" }) });
    const labels = Array.from(document.querySelectorAll(".nb-map-cta, .nb-pencil-cta")).map(
      (node) => node.textContent?.trim(),
    );
    expect(labels).toEqual([
      "Map to a workstream",
      analysisPreset("verification")!.label,
      analysisPreset("decision_origin")!.label,
    ]);
  });

  it("says Remap once the work is mapped", () => {
    bar({ item: item({ visibility: "mapped" }) });
    expect(screen.getByText("Remap")).toBeTruthy();
  });

  it("gives a thread both the fact check and the decisions button", () => {
    bar();
    expect(screen.getByText(analysisPreset("verification_thread")!.label)).toBeTruthy();
    expect(screen.getByText(analysisPreset("decision_origin")!.label)).toBeTruthy();
  });

  it("shows a coach none of the owner only analyses", () => {
    bar({ canEdit: false, owned: false, item: item({ type: "document" }) });
    expect(document.querySelectorAll(".nb-map-cta, .nb-pencil-cta").length).toBe(0);
  });

  it("uses the small pencil CTA variant with its analysis seeds", () => {
    bar({ item: item({ type: "document" }) });
    const seeds = Array.from(document.querySelectorAll(".nb-pencil-cta--sm")).map((node) =>
      node.getAttribute("data-seed"),
    );
    expect(seeds).toEqual(["peek-verify", "peek-decisions"]);
  });
});

describe("pass 129 — names and structure", () => {
  it("renames the decisions preset label without touching its id", () => {
    const preset = analysisPreset("decision_origin")!;
    expect(preset.label).toBe("What got decided");
    expect(preset.dbPreset).toBe("decision_origin");
  });

  it("reads labels from the registry, never from a literal", () => {
    expect(BAR_SRC).toContain("analysisPreset(");
    expect(BAR_SRC).not.toContain("What to fact check");
    expect(BAR_SRC).not.toContain("What got decided");
    expect(BAR_SRC).not.toContain("Who decided what");
  });

  it("mounts the bar in the peek and deletes the footer", () => {
    expect(PEEK_SRC).toContain("<PeekActionBar");
    expect(PEEK_SRC).not.toContain("</footer>");
    expect(PEEK_SRC).not.toContain("FooterAction");
  });

  it("keeps the overflow order fixed, with Make private above the separator", () => {
    const order = [
      "PEEK_WORK_ARTIFACT_LABEL",
      "SHIP_ACTION_LABEL",
      "PEEK_WORK_DATE_LABEL",
      "Mark as the brief",
      "Find decisions in this conversation",
      "PEEK_MAKE_PRIVATE_LABEL",
      "DropdownMenuSeparator",
      "REMOVE_LABEL",
      "DELETE_LABEL",
    ];
    const menu = BAR_SRC.slice(BAR_SRC.indexOf("<DropdownMenuContent"));
    const found = order.map((token) => menu.indexOf(token));
    expect(found.every((index) => index > 0)).toBe(true);
    expect([...found].sort((a, b) => a - b)).toEqual(found);
  });

  it("keeps delete quiet: a destructive text row, never a red fill", () => {
    expect(BAR_SRC).toContain("text-destructive focus:text-destructive");
    expect(BAR_SRC).not.toContain("bg-destructive");
  });
});

describe("pass 129 — make private and the confirms", () => {
  it("wires one shared make private path through both peek surfaces", () => {
    expect(WORK_SRC).toContain("useMakePrivate");
    expect(ENGAGEMENT_SRC).toContain("useMakePrivate");
    expect(ENGAGEMENT_SRC).toContain("onMakePrivate={(item)");
    expect(WORK_SRC).toContain("onMakePrivate={(item)");
  });

  it("mounts map, work date and the lens on the engagement peek too", () => {
    expect(ENGAGEMENT_SRC).toContain("<MapDialog");
    expect(ENGAGEMENT_SRC).toContain("<WorkDateDialog");
    expect(ENGAGEMENT_SRC).toContain("<AnalysisLens");
  });

  it("states each consequence in one plain line", () => {
    expect(REMOVE_CONSEQUENCE_LINE).toBe(
      "This takes the work out of this engagement. The work itself stays.",
    );
    expect(DELETE_CONSEQUENCE_LINE).toBe("This deletes the work and its record. There is no undo.");
    expect(REMOVE_CONSEQUENCE_LINE).not.toContain("—");
    expect(DELETE_CONSEQUENCE_LINE).not.toContain("—");
  });
});

describe("pass 129 — reader cleanup", () => {
  it("draws the reading trail from journey-path", () => {
    expect(readingTrailD(0)).toBe("M 9 0 Q 12 0 9 0");
    expect(readingTrailD(1)).toBe("M 9 0 Q 12 50 9 100");
    expect(READER_SRC).toContain("readingTrailD(story.progress)");
    expect(READER_SRC).not.toContain("M 9 0 Q");
  });
});
