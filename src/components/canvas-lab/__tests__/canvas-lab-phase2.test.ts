import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const recorded: { event: string; dims: Record<string, unknown> }[] = [];
vi.mock("@/lib/telemetry", () => ({ logEvent: (event: string, _orgId: string, dims: Record<string, unknown>) => recorded.push({ event, dims }) }));

import {
  noteWorkboardCardMenuOpened,
  noteWorkboardNodeCreated,
  noteWorkboardNodeDeleted,
  noteWorkboardNodeEdited,
  noteWorkboardRail,
  noteWorkboardRecordVisibility,
  noteWorkboardRelationship,
  noteWorkboardReviewOpened,
  noteWorkboardTrailSelected,
} from "@/components/canvas-lab/canvas-lab-telemetry";

const read = (path: string) => readFileSync(path, "utf8");

describe("Canvas Lab Phase 2", () => {
  beforeEach(() => { recorded.length = 0; });

  it("registers and emits every new action with closed dimensions", () => {
    noteWorkboardRail("org", "collapsed");
    noteWorkboardNodeCreated("org", "human_judgment", "corrected_ai");
    noteWorkboardNodeEdited("org", "human_judgment");
    noteWorkboardNodeDeleted("org", "human_judgment");
    noteWorkboardRecordVisibility("org", "hidden", "work");
    noteWorkboardRelationship("org", "created", "context");
    noteWorkboardReviewOpened("org", "deck");
    noteWorkboardTrailSelected("org", "context", "item");
    noteWorkboardCardMenuOpened("org", "deliverable", "yours");
    expect(recorded).toEqual([
      { event: "workboard.rail_toggled", dims: { state: "collapsed" } },
      { event: "workboard.node_created", dims: { kind: "human_judgment", judgment_type: "corrected_ai" } },
      { event: "workboard.node_edited", dims: { kind: "human_judgment" } },
      { event: "workboard.node_deleted", dims: { kind: "human_judgment" } },
      { event: "workboard.record_visibility_changed", dims: { action: "hidden", record_kind: "work" } },
      { event: "workboard.relationship_changed", dims: { action: "created", relation: "context" } },
      { event: "workboard.review_opened", dims: { format: "deck" } },
      { event: "workboard.trail_item_selected", dims: { group: "context", focus: "item" } },
      { event: "workboard.card_menu_opened", dims: { node_kind: "deliverable", ownership: "yours" } },
    ]);
    const catalog = read("src/lib/telemetry-shared.ts");
    for (const entry of recorded) expect(catalog).toContain(`| "${entry.event}"`);
  });

  it("keeps Ask Lasso beside the board and the narrow-screen switch opens it (B2)", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).not.toContain("absolute inset-x-0 bottom-3");
    expect(page).not.toContain("<WorkRail");
    expect(page).toContain('data-toolbar-control="working-from" onClick={() => setAskOpen(true)}');
  });

  it("opens the Lab-only review without the production confirmation flow", () => {
    const review = read("src/components/canvas-lab/CanvasLabReview.tsx");
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(review).toContain("getSpanAudit");
    expect(review).toContain("getRenditionUrl");
    expect(review).toContain("Context");
    expect(review).toContain("AI work");
    expect(review).toContain("Human judgment");
    expect(review).toContain("Decisions");
    expect(review).not.toContain("AnalysisConfirm");
    expect(review).not.toContain("draftLineage");
    expect(review).not.toContain("reviewLink");
    expect(review).toContain("inboundLabNodeIds(nodes, links, anchorNodeId)");
    expect(review).toContain('node.kind === "judgment" && connectedNodeIds.has(node.id)');
    expect(review).toContain("connectedNodeIds.has(comment.nodeId)");
    expect(review).not.toContain('nodes.filter((node) => node.kind === "judgment").map');
    expect(page).toContain("anchorNodeId={reviewNode.id} links={links}");
  });

  it("uses green Lab emphasis and leaves production canvas untouched", () => {
    const styles = read("src/styles.css");
    const page = read("src/pages/CanvasLabPage.tsx");
    const relationships = read("src/components/canvas-lab/LabRelationships.tsx");
    expect(styles).toContain("::highlight(canvas-lab-selection) { background: var(--nb-green-wash); }");
    expect(relationships).toContain('stroke={selected ? "var(--nb-green)" : "var(--nb-graphite)"}');
    expect(page).not.toContain("drawCanvasLinkFn");
  });
});