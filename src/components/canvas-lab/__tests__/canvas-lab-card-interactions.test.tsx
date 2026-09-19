import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Canvas Lab card interaction correction", () => {
  it("keeps the outline on paper and exposes four side anchors", () => {
    const card = read("src/components/canvas-lab/LabCard.tsx");
    const styles = read("src/styles.css");
    expect(card).toContain("canvas-lab-card-paper");
    expect(card).toContain('data-side={side}');
    expect(card).toContain('aria-label={`Connect from ${side}`}');
    expect(card).toContain('<Button key={side} type="button" size="icon" variant="ghost"');
    expect(styles).toContain('.canvas-lab-card-paper[data-selected="true"]');
    for (const side of ["top", "right", "bottom", "left"]) expect(styles).toContain(`data-side="${side}"`);
    expect(card).toContain("canvas-lab-resize-handle");
    expect(styles).toContain("width: 8px;");
    expect(styles).toContain("border: 1.4px solid var(--nb-green);");
    expect(styles).toContain("border-radius: 1px;");
    expect(styles).toContain("cursor: crosshair;");
    expect(styles).toContain('[data-interaction="drag"]');
    expect(styles).toContain('data-corner="nw"');
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
  });
});