// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("CanvasLabPage passes a computed removable from the teammate mark", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("removable={cardRemovable(node, cardItem)}");
    expect(page).toMatch(/const cardRemovable = [^\n]*teammateMarkByNode/);
    expect(readFileSync("src/components/canvas-lab/LabCard.tsx", "utf8")).toContain("removable={(removable ?? true)");
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
