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

  it("adds one workboard entry and preserves the production canvas call", () => {
    const page = read("src/pages/EngagementPage.tsx");
    expect(page).toContain("open the workboard");
    expect(page).toContain("Arrange the engagement at full size. This prototype resets when you refresh.");
    expect(page).toContain("Open workboard");
    expect(page).toContain('<EngagementCanvasView engagementId={engagementId} items={scopedItems} onOpen={openPeek} />');
  });

  it("keeps focused provenance and clears the selection highlight", () => {
    const overlay = read("src/components/canvas-lab/FocusOverlay.tsx");
    expect(overlay).toContain("<WhatFedThisButton items={[item]}");
    expect(overlay).toContain('CSS.highlights?.delete("canvas-lab-selection")');
    expect(overlay).toContain("{comments.length + 1}");
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