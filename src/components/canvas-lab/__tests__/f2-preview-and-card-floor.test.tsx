// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => true }));

import { LabCard } from "@/components/canvas-lab/LabCard";
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  resizeLabRect,
  type LabNode,
} from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";
import { validWorkboardNodeGeometry } from "@/lib/canvas-lab-shared";

const node: LabNode = {
  id: "work:one",
  kind: "work",
  frame: null,
  title: "Proposal",
  summary: "A proposal",
  typeLabel: "document",
  ownership: "yours",
  workItemId: "one",
  x: 0,
  y: 0,
  width: 300,
  height: 240,
};

const item: WorkItemRow = {
  id: "one",
  title: "Proposal",
  type: "document",
  source: "upload",
  source_vendor: null,
  visibility: "mapped",
  captured_at: "2026-09-21T00:00:00Z",
  content_ref: "proposal.pdf",
  work_item_tasks: [],
};

const cardProps = {
  node,
  item,
  selected: false,
  focused: false,
  onSelect: () => undefined,
  onOpen: () => undefined,
  onBranch: () => undefined,
  onHide: () => undefined,
  onDelete: () => undefined,
  onEdit: () => undefined,
  onEditCommitted: () => undefined,
  connecting: false,
  connectSourceAnchor: null,
  onAnchorPointerDown: () => undefined,
  onAnchorActivate: () => undefined,
  onMenuOpened: () => undefined,
  onMenuOpenChange: () => undefined,
  onMeasure: () => undefined,
  onPointerDown: () => undefined,
  onFocus: () => undefined,
  onKeyDown: () => undefined,
  canResize: false,
  onResizeStart: () => undefined,
  onFit: () => undefined,
  onResizeKeyDown: () => undefined,
  onResizeKeyUp: () => undefined,
  frameChoices: [],
  structured: false,
  onMoveToFrame: () => undefined,
};

afterEach(cleanup);

describe("Unit 5a.1 shared Ledger workboard card", () => {
  it("renders WorkNote's brand edge with no folded corner", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const card = render(
      <LabCard
        {...cardProps}
        filePreview={{ workItemId: item.id, kind: "text", url: null, lines: ["Rendered page"], slideTitle: null, versionCount: 1 }}
      />,
    );
    const face = card.container.querySelector<HTMLElement>(".ledger-work-note");
    expect(face).not.toBeNull();
    expect(face?.style.borderLeftColor).not.toBe("");
    expect(card.container.querySelector(".fold")).toBeNull();
  });
});

describe("F2 readable card floor", () => {
  it("does not let resize make a card smaller than a readable document frame", () => {
    expect(CARD_MIN_WIDTH).toBeGreaterThanOrEqual(260);
    expect(CARD_MIN_HEIGHT).toBe(180);
    expect(resizeLabRect(node, "se", { x: -1000, y: -1000 }, false, "card")).toMatchObject({
      width: CARD_MIN_WIDTH,
      height: CARD_MIN_HEIGHT,
    });
    expect(validWorkboardNodeGeometry({ w: CARD_MIN_WIDTH, h: CARD_MIN_HEIGHT })).toBe(true);
  });
});