// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { cleanup, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LabCard } from "@/components/canvas-lab/LabCard";

const read = (path: string) => readFileSync(path, "utf8");

describe("Canvas Lab card interaction correction", () => {
  it("renders native controls without shadcn sizing classes", () => {
    globalThis.ResizeObserver = class { observe() {} disconnect() {} unobserve() {} } as typeof ResizeObserver;
    const { container } = render(<LabCard node={{ id: "n", kind: "judgment", frame: "f", title: "Judgment", summary: "Reason", typeLabel: "judgment", ownership: "draft", local: true, x: 0, y: 0, width: 232, height: 112 }} selected focused={false} connecting={false} connectSourceAnchor={null} canResize onSelect={() => undefined} onOpen={() => undefined} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} onEdit={() => undefined} onEditCommitted={() => undefined} onAnchorPointerDown={() => undefined} onAnchorActivate={() => undefined} onMenuOpened={() => undefined} onMenuOpenChange={() => undefined} onMeasure={() => undefined} onPointerDown={() => undefined} onKeyDown={() => undefined} onResizeStart={() => undefined} onFit={() => undefined} onResizeKeyDown={() => undefined} onResizeKeyUp={() => undefined} frameChoices={[]} structured onMoveToFrame={() => undefined} />);
    const styles = read("src/styles.css");
    const controls = container.querySelectorAll(".canvas-lab-anchor, .canvas-lab-resize-handle");
    expect(controls).toHaveLength(8);
    for (const control of controls) {
      expect(control.tagName).toBe("BUTTON");
      expect(control.className).not.toMatch(/h-9|w-9|rounded-md/);
    }
    expect(container.querySelectorAll(".canvas-lab-anchor")).toHaveLength(4);
    expect(container.querySelectorAll(".canvas-lab-resize-handle")).toHaveLength(4);
    expect(styles).toContain('.canvas-lab-card-paper[data-selected="true"]');
    for (const side of ["top", "right", "bottom", "left"]) expect(styles).toContain(`data-side="${side}"`);
    expect(styles).toMatch(/\.canvas-lab-anchor \{[^}]*width: 8px;[^}]*height: 8px;/s);
    expect(styles).toMatch(/\.canvas-lab-anchor \{[^}]*border-radius: 50%;/s);
    expect(styles).toMatch(/\.canvas-lab-anchor \{[^}]*cursor: crosshair;/s);
    expect(styles).toMatch(/\.canvas-lab-resize-handle \{[^}]*width: 8px;[^}]*height: 8px;/s);
    expect(styles).toMatch(/\.canvas-lab-resize-handle \{[^}]*border: 1\.4px solid var\(--nb-green\);/s);
    expect(styles).toMatch(/\.canvas-lab-resize-handle \{[^}]*border-radius: 1px;/s);
    expect(styles).toMatch(/data-corner="nw"[^}]*cursor: nwse-resize;/s);
    expect(styles).toMatch(/data-corner="ne"[^}]*cursor: nesw-resize;/s);
    expect(styles).toContain('[data-interaction="drag"]');
    cleanup();
  });

  it("keeps resize, structure, and reassignment bounded to the workboard", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain('useState<LabStructureMode>("structured")');
    expect(page).toContain('noteWorkboardStructureToggled(orgId, "freeform")');
    expect(page).toContain('noteWorkboardElementResized(orgId, "card"');
    expect(page).toContain('frameId: durableTarget');
    expect(page).not.toContain("frameWithChildren");
  });

  it("opens one shared ownership-aware menu from pointer and keyboard paths", () => {
    const card = read("src/components/canvas-lab/LabCard.tsx");
    const menu = read("src/components/canvas-lab/LabCardMenu.tsx");
    expect(card).toContain("onContextMenu={openMenu}");
    expect(card).toContain('event.shiftKey && event.key === "F10"');
    expect(card).toContain('event.key === "ContextMenu"');
    expect(menu).toContain('aria-label="Open card menu"');
    expect(read("src/styles.css")).toContain("width: 44px;");
    expect(menu).toContain("cardRef.current?.focus()");
    expect(menu).toContain("Remove from canvas");
    expect(menu).toContain("Delete local node");
  });

  it("uses anchored pointer and accessible two-step relationship paths", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    expect(page).toContain("startPointerConnect(node, side, event)");
    expect(page).toContain("chooseConnectAnchor(node, side)");
    expect(page).toContain("nearestLabAnchor(stagePoint");
    expect(page).toContain("labConnectorPath(from, link.fromAnchor, to, link.toAnchor)");
    expect(page).toContain('noteWorkboardRelationship(orgId, "started")');
    expect(page).toContain('noteWorkboardRelationship(orgId, "created")');
    expect(page).toContain('noteWorkboardRelationship(orgId, "rejected")');
    expect(page).toContain('noteWorkboardRelationship(orgId, "cancelled")');
  });

  it("adds only the approved card-menu event dimensions", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    const telemetry = read("src/components/canvas-lab/canvas-lab-telemetry.ts");
    expect(page).toContain("noteWorkboardCardMenuOpened(orgId, eventKind(node), node.ownership)");
    expect(telemetry).toContain('logEvent("workboard.card_menu_opened", orgId, { node_kind: nodeKind, ownership })');
    expect(telemetry).toContain('LabNodeEventKind | "frame"');
    expect(telemetry).toContain('LabOwnershipEvent | "shared"');
    expect(page).toContain('noteWorkboardCardMenuOpened(orgId, "frame", "shared")');
  });
});