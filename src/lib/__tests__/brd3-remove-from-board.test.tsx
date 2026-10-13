// @vitest-environment jsdom
// Behavioural coverage for these predicates lives in board-permissions.behaviour.test.ts; keep this file to wording and wiring pins.
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { LabCardMenu } from "@/components/canvas-lab/LabCardMenu";

const noop = () => undefined;
afterEach(cleanup);

async function openMenu(removable: boolean) {
  render(<LabCardMenu selected={false} canBranch={false} local={false} removable={removable} open onOpenChange={noop} cardRef={{ current: null }} onSelect={noop} onOpen={noop} onBranch={noop} onHide={noop} onDelete={noop} />);
  return screen;
}

describe("BRD-3 remove from board", () => {
  it("offers a disabled author-only item when not removable", async () => {
    await openMenu(false);
    const item = await screen.findByText("Only the author can remove this");
    expect(item.closest("[role=menuitem]")?.getAttribute("data-disabled")).not.toBeNull();
    expect(screen.queryByText("Remove from board")).toBeNull();
  });

  it("offers Remove from board when removable", async () => {
    await openMenu(true);
    expect(await screen.findByText("Remove from board")).toBeTruthy();
  });

  it("drops the old hide wording", () => {
    expect(readFileSync("src/components/canvas-lab/LabCardMenu.tsx", "utf8")).not.toContain("Hide from this board");
  });

  it("CanvasLabPage passes a computed removable from work ownership, not the teammate mark", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("removable={cardRemovable(node, cardItem)}");
    const predicate = page.slice(page.indexOf("const cardRemovable ="), page.indexOf("const cardRemovable =") + 400);
    expect(predicate).toContain("ownsWorkItem(profile, item)");
    expect(predicate).not.toContain("teammateMarkByNode");
    // A decoration node (sticky, text, grouping, judgment, decision, brief) is removable as before.
    expect(predicate).toContain("if (!node.workItemId) return true;");
    // A work node whose row has not loaded falls back to the node author, never to "removable".
    expect(predicate).toContain("node.authorProfileId === profile?.id");
    expect(readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8")).toContain("removable={(removable ?? true)");
  });

  it("every LabCard render in CanvasLabPage carries the removable guard", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const sites = page.match(/<LabCard\b/g)?.length ?? 0;
    expect(sites).toBeGreaterThan(0);
    expect(page.match(/removable=\{cardRemovable\(/g)?.length ?? 0).toBe(sites);
  });

  it("the hide handler un-places the work and the toast names your work", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const hide = page.slice(page.indexOf("function hideNode("), page.indexOf("function hideNode(") + 1200);
    expect(hide).toContain("setWorkPlacement(node.id, false)");
    expect(page).toContain('.from("work_item_tasks").delete()');
    expect(page).toContain("Removed from the board. It is still in your work.");
    expect(page).toContain('update({ hidden: false, deleted_at: null })');
  });
});
