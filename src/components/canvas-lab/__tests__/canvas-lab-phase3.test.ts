import { readFileSync } from "fs";
import { describe, expect, it } from "vitest";

import {
  applyDurableBoard,
  dropPromptFrame,
  createLabFrames,
  inboundLabNodeIds,
  seedCanvas,
  fitWorkboardViewport,
  stageBounds,
  type LabLink,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import type { WorkboardDto } from "@/lib/canvas-lab-shared";

const baseFrames = createLabFrames([{ id: "task-1", name: "Discovery" }]);
const baseNodes = seedCanvas(
  {
    brief: { title: "The brief", text: "Grow the north region." },
    tasks: [{ id: "task-1", name: "Discovery", detail: null, ownedByViewer: true }],
    work: [{ id: "work-1", title: "Thread A", typeLabel: "ai thread", source: "chatgpt", ownedByViewer: true, taskIds: ["task-1"], deliverable: true }],
    decisions: [{ id: "decision-1", call: "Ship pilot", situation: "Scope", ownedByViewer: true }],
  },
  baseFrames,
);

function board(overrides: Partial<WorkboardDto> = {}): WorkboardDto {
  return {
    id: "board-1",
    engagementId: "eng-1",
    version: 1,
    frames: [],
    nodes: [],
    links: [],
    viewerProfileId: "me",
    canEditStructure: true,
    ...overrides,
  };
}

describe("applyDurableBoard", () => {
  it("loads a saved layout with positive frames and a negative-position card", () => {
    const saved = board({
      frames: [
        { id: "frame-foundation", key: "foundation", kind: "foundation", taskId: null, label: null, x: 60, y: 420, w: 430, h: 520, ord: 0, version: 2 },
        { id: "frame-discovery", key: "task:task-1", kind: "task", taskId: "task-1", label: "Discovery", x: 526, y: 420, w: 430, h: 520, ord: 1, version: 2 },
      ],
      nodes: [
        { id: "node-brief", frameId: "frame-foundation", kind: "brief", workItemId: null, decisionId: null, authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null, x: 88, y: 484, w: 232, h: 112, hidden: false, version: 2, referenceReadable: true },
        { id: "node-work", frameId: "frame-discovery", kind: "work_item", workItemId: "work-1", decisionId: null, authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null, x: -154, y: -88, w: 232, h: 112, hidden: false, version: 3, referenceReadable: true },
      ],
    });

    const loaded = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, saved);
    const negative = loaded.nodes.find((node) => node.durableId === "node-work");
    expect(negative).toMatchObject({ x: -154, y: -88 });
    expect(stageBounds(loaded.frames)).toEqual(expect.objectContaining({ width: expect.any(Number), height: expect.any(Number) }));
    const fitted = fitWorkboardViewport({ width: 1200, height: 760 }, loaded.frames, loaded.nodes, new Map());
    expect(fitted.bounds.x).toBe(-154);
    expect(Number.isFinite(fitted.zoom)).toBe(true);
    expect(Number.isFinite(fitted.pan.x)).toBe(true);
    expect(Number.isFinite(fitted.pan.y)).toBe(true);
  });

  it("overlays durable placement and hidden state onto virtual reference cards", () => {
    const merged = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, board({
      nodes: [{
        id: "node-1", frameId: null, kind: "work_item", workItemId: "work-1", decisionId: null,
        authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null,
        x: 999, y: 888, w: 360, h: 180, hidden: true, version: 3, referenceReadable: true,
      }],
    }));
    const card = merged.nodes.find((node) => node.id === "work:work-1");
    expect(card?.x).toBe(999);
    expect(card).toMatchObject({ width: 360, height: 180 });
    expect(card?.durableId).toBe("node-1");
    expect(card?.durableVersion).toBe(3);
    expect(merged.hiddenIds).toEqual(["work:work-1"]);
  });

  it("rehydrates authored judgment cards and keeps teammate authorship", () => {
    const merged = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, board({
      nodes: [{
        id: "node-9", frameId: null, kind: "judgment", workItemId: null, decisionId: null,
        authorProfileId: "teammate", authorName: "Lee", title: "Changed direction", body: "Chose retention over reach.",
        judgmentType: "changed_direction", x: 10, y: 20, w: 232, h: 112, hidden: false, version: 1, referenceReadable: true,
      }],
    }));
    const judgment = merged.nodes.find((node) => node.durableId === "node-9");
    expect(judgment?.id).toBe("durable:node-9");
    expect(judgment?.ownership).toBe("teammate");
    expect(judgment?.local).toBe(false);
    expect(judgment?.summary).toBe("Chose retention over reach.");
  });

  it("marks the viewer's own judgment editable and adds custom frames with durable keys", () => {
    const merged = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, board({
      frames: [{ id: "frame-9", key: "custom:risks", kind: "custom", taskId: null, label: "Risks", x: 1, y: 2, w: 300, h: 200, ord: 4, version: 1 }],
      nodes: [{
        id: "node-7", frameId: "frame-9", kind: "judgment", workItemId: null, decisionId: null,
        authorProfileId: "me", authorName: "Me", title: "Corrected AI", body: "Fixed the figure.",
        judgmentType: "corrected_ai", x: 30, y: 40, w: 232, h: 112, hidden: false, version: 2, referenceReadable: true,
      }],
    }));
    expect(merged.frames.some((frame) => frame.id === "custom:risks" && frame.durableId === "frame-9")).toBe(true);
    const judgment = merged.nodes.find((node) => node.durableId === "node-7");
    expect(judgment?.frame).toBe("custom:risks");
    expect(judgment?.local).toBe(true);
  });

  it("maps durable links to local cards and drops links with missing endpoints", () => {
    const merged = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, board({
      nodes: [
        { id: "n1", frameId: null, kind: "brief", workItemId: null, decisionId: null, authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null, x: 0, y: 0, w: 232, h: 112, hidden: false, version: 1, referenceReadable: true },
        { id: "n2", frameId: null, kind: "work_item", workItemId: "work-1", decisionId: null, authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null, x: 0, y: 0, w: 232, h: 112, hidden: false, version: 1, referenceReadable: true },
      ],
      links: [
        { id: "link-1", fromNodeId: "n1", toNodeId: "n2", fromAnchor: "right", toAnchor: "left", relation: "informed", authorProfileId: "me", version: 1 },
        { id: "link-2", fromNodeId: "n1", toNodeId: "gone", fromAnchor: "right", toAnchor: "left", relation: "context", authorProfileId: "me", version: 1 },
      ],
    }));
    expect(merged.links).toHaveLength(1);
    expect(merged.links[0]).toMatchObject({ fromId: "brief", toId: "work:work-1", durableId: "link-1", relation: "informed" });
  });

});

describe("inboundLabNodeIds", () => {
  const nodes = [
    { id: "a" }, { id: "b" }, { id: "c" }, { id: "d" },
  ] as LabNode[];
  const links: LabLink[] = [
    { id: "l1", fromId: "a", toId: "b", fromAnchor: "right", toAnchor: "left" },
    { id: "l2", fromId: "b", toId: "c", fromAnchor: "right", toAnchor: "left" },
    { id: "l3", fromId: "c", toId: "a", fromAnchor: "right", toAnchor: "left" },
  ];

  it("walks only inbound explicit relationships from the reviewed card", () => {
    expect([...inboundLabNodeIds(nodes, links, "c")].sort()).toEqual(["a", "b", "c"]);
    expect(inboundLabNodeIds(nodes, links, "a").has("d")).toBe(false);
  });

  it("survives cycles and ignores links with missing endpoints", () => {
    const broken: LabLink[] = [...links, { id: "l4", fromId: "a", toId: "missing", fromAnchor: "right", toAnchor: "left" }];
    expect(inboundLabNodeIds(nodes, broken, "a").size).toBe(3);
  });

  it("bounds the walk and returns empty for an unknown anchor", () => {
    const chain: LabLink[] = Array.from({ length: 12 }, (_, index) => ({ id: `c${index}`, fromId: `n${index}`, toId: `n${index + 1}`, fromAnchor: "right" as const, toAnchor: "left" as const }));
    const chainNodes = Array.from({ length: 13 }, (_, index) => ({ id: `n${index}` })) as LabNode[];
    expect(inboundLabNodeIds(chainNodes, chain, "n12").size).toBeLessThanOrEqual(9);
    expect(inboundLabNodeIds(nodes, links, "unknown").size).toBe(0);
  });
});

describe("phase 3 persistence events", () => {
  const catalog = readFileSync("src/lib/telemetry-shared.ts", "utf8");
  const helpers = readFileSync("src/components/canvas-lab/canvas-lab-telemetry.ts", "utf8");

  it("registers the three approved persistence events", () => {
    expect(catalog).toContain('"workboard.change_saved"');
    expect(catalog).toContain('"workboard.save_failed"');
    expect(catalog).toContain('"workboard.conflict_resolved"');
  });

  it("ships content-free helper wrappers", () => {
    for (const name of ["noteWorkboardChangeSaved", "noteWorkboardSaveFailed", "noteWorkboardConflictResolved"]) {
      expect(helpers).toContain(`export function ${name}`);
    }
    expect(helpers).not.toContain("body");
  });

  it("registers content-free resize and local structure events", () => {
    expect(catalog).toContain('"workboard.element_resized"');
    expect(catalog).toContain('"workboard.structure_toggled"');
    expect(helpers).toContain('{ element_kind: elementKind, method, axis }');
    expect(helpers).toContain('{ state }');
  });
});

describe("drop prompt on a durable board", () => {
  it("offers the workstream under the card even when the home frame overlaps it", () => {
    const merged = applyDurableBoard({ frames: baseFrames, nodes: baseNodes }, board({
      frames: [
        { id: "frame-a", key: "task:task-1", kind: "task", taskId: "task-1", label: "Discovery", x: 60, y: 420, w: 1200, h: 900, ord: 0, version: 1 },
        { id: "frame-b", key: "custom:readout", kind: "custom", taskId: null, label: "Readout deck", x: 900, y: 460, w: 380, h: 420, ord: 1, version: 1 },
      ],
      nodes: [{
        id: "node-1", frameId: "frame-a", kind: "work_item", workItemId: "work-1", decisionId: null,
        authorProfileId: "me", authorName: "Me", title: "", body: "", judgmentType: null,
        x: 1000, y: 520, w: 232, h: 112, hidden: false, version: 1, referenceReadable: true,
      }],
    }));
    const card = merged.nodes.find((node) => node.durableId === "node-1");
    expect(card?.frame).toBe("task:task-1");
    if (!card) return;
    expect(dropPromptFrame(card, merged.frames, "structured", true)?.name).toBe("Readout deck");
    expect(dropPromptFrame(card, merged.frames, "freeform", true)).toBeNull();
  });
});
