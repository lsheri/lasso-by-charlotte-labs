import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Canvas Lab second prototype pass", () => {
  it("opens as a full-screen shell without fake presence or global modes", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain('className="fixed inset-0 z-50 flex');
    expect(page).not.toContain("example:teammate");
    expect(page).not.toContain("Cards/Live");
    expect(page).not.toContain("PermissionLegend");
    expect(page).not.toContain('>Connect</Button>');
    expect(page).not.toContain("connectMode");
  });

  it("uses card-edge anchors and a contextual menu instead of a permanent tray", () => {
    const card = read("src/components/canvas-lab/LabCard.tsx");
    const menu = read("src/components/canvas-lab/LabCardMenu.tsx");
    expect(card).toContain('const anchors: LabAnchor[] = ["top", "right", "bottom", "left"]');
    expect(card).toContain("canvas-lab-card-paper");
    expect(card).toContain("<LabCardMenu");
    expect(card).not.toContain('className="mt-1 flex flex-wrap');
    expect(menu).toContain("Use as context");
    expect(menu).toContain("Hide from this board");
    expect(menu).toContain("Delete this work");
  });

  it("keeps all six contextual prompt starters", () => {
    const composer = read("src/components/canvas-lab/ContextComposer.tsx");
    for (const starter of [
      "Find tension",
      "Challenge this recommendation",
      "What is still an assumption?",
      "What would a principal ask?",
      "Draft a decision",
      "Trace a number",
    ]) expect(composer).toContain(starter);
    expect(composer).toContain("Add draft thread");
  });

  it("adds both workboard entries and preserves the production canvas call", () => {
    const page = read("src/pages/EngagementPage.tsx");
    expect(page).toContain('search={{ from: "header" }}');
    expect(page).toContain('search={{ from: "canvas_tab" }}');
    expect(page).toContain("Arrange this engagement&apos;s work, calls and judgment on one board. Changes save as you go.");
    expect(page).not.toContain("prototype resets");
    expect(page).toContain("Open workboard");
    expect(page).toContain('<EngagementCanvasView engagementId={engagementId} items={scopedItems} onOpen={openPeek} />');
  });

  it("keeps focused notes, clears the selection highlight, and uses the Lab review", () => {
    const overlay = read("src/components/canvas-lab/FocusOverlay.tsx");
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("<CanvasLabReview");
    expect(overlay).not.toContain("WhatFedThisButton");
    expect(overlay).toContain('CSS.highlights?.delete("canvas-lab-selection")');
    expect(overlay).not.toContain("notes in the margin");
    expect(overlay).not.toContain("items: WorkItemRow[]");
  });

  it("cancels only modifier-wheel browser zoom on a non-passive listener", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain('if (!event.ctrlKey && !event.metaKey) return;');
    expect(page).toContain("event.preventDefault();");
    expect(page).toContain('addEventListener("wheel", onModifierWheel, { passive: false })');
  });

  it("registers the unfold event and a reduced-motion answer", () => {
    const registry = read("src/lib/motion-registry.ts");
    expect(registry).toContain('"canvas.unfolded"');
    expect(registry).toContain('motion: "workboard-unfold"');
    expect(registry).toContain('reduced: "Workboard open"');
    expect(read("src/styles.css")).toContain(".canvas-lab-unfold-panel { animation: none !important;");
  });
});