// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LabFrame } from "@/components/canvas-lab/LabFrame";
import { boxRemoval, canRenameBox, regionNameAction } from "@/lib/board-workstream-delete";
import { deleteWorkstreamRow, WORKSTREAM_IS_DEFAULT, WORKSTREAM_NOT_OWNER } from "@/lib/workstreams.server";

afterEach(cleanup);

const owner = { id: "p1", role: "em" };
const other = { id: "p2", role: "em" };
const task = { id: "t1", owner_id: "p1", is_board_default: false, work_item_tasks: [] };
const fallback = { ...task, id: "t0", is_board_default: true };
const region = { id: "region:a", name: "Revenue", x: 0, y: 0, width: 400, height: 300, durableId: "f1" };

function renderBox(profile: typeof owner, opts: { backed?: boolean; editable?: boolean; name?: string } = {}) {
  const backed = opts.backed ?? true;
  const removal = boxRemoval({ custom: true, seeded: false, profile, task: backed ? task : null, cardsInBox: 0, backed });
  const onRename = vi.fn();
  render(<LabFrame frame={{ ...region, name: opts.name ?? region.name }} count={0} selected editable={opts.editable ?? true} custom region namedByWorkstream={false} kind="custom" removable={removal.offer === "none" ? true : removal.removable} removal={removal.offer} renamable={canRenameBox({ backed, profile, task: backed ? task : null })} onSelect={vi.fn()} onResizeStart={vi.fn()} onFit={vi.fn()} onRename={onRename} onRemove={vi.fn()} onMenuOpened={vi.fn()} onMenuOpenChange={vi.fn()} onUseAsContext={vi.fn()} />);
  return { onRename };
}
function openMenu() { fireEvent.pointerDown(screen.getByRole("button", { name: "Workstream options" }), { button: 0, ctrlKey: false }); }

function fakeClient(row: Record<string, unknown>) {
  const deletes: string[] = [];
  const chain: Record<string, unknown> = {};
  chain["select"] = () => chain;
  chain["delete"] = () => { deletes.push("tasks"); return chain; };
  chain["eq"] = () => chain;
  chain["maybeSingle"] = () => Promise.resolve({ data: row, error: null });
  return { client: { from: () => chain } as never, deletes };
}

describe("WK2 owner only", () => {
  it("the owner still sees Remove, Rename, and can unname", () => {
    renderBox(owner);
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Remove box and delete workstream" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    expect(regionNameAction({ clearing: true, taskId: "t1", task, profile: owner, cardsInBox: 0 }).action).toBe("clear_and_delete");
    expect(regionNameAction({ clearing: false, taskId: "t1", task, profile: owner, cardsInBox: 0 }).action).toBe("rename");
  });
  it("a non-owning editor sees no Remove and cannot rename or unname", () => {
    const { onRename } = renderBox(other);
    openMenu();
    expect(screen.queryByRole("menuitem", { name: /Remove/ })).toBeNull();
    expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Use as context" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Fit contents" })).toBeTruthy();
    fireEvent.doubleClick(screen.getByText("Revenue"));
    expect(screen.queryByRole("textbox", { name: "Rename workstream" })).toBeNull();
    expect(onRename).not.toHaveBeenCalled();
    expect(regionNameAction({ clearing: true, taskId: "t1", task, profile: other, cardsInBox: 0 }).action).toBe("not_owner");
    expect(regionNameAction({ clearing: false, taskId: "t1", task, profile: other, cardsInBox: 0 }).action).toBe("not_owner");
  });
  it("the board refuses a non-owner name change before anything is sent", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    const body = page.slice(page.indexOf("async function changeRegionName"));
    expect(body.indexOf('nameAction.action === "not_owner"')).toBeGreaterThan(-1);
    expect(body.indexOf('nameAction.action === "not_owner"')).toBeLessThan(body.indexOf("deleteWorkstreamCall("));
  });
  it("an unnamed region with no workstream stays fully editable by any editor", () => {
    renderBox(other, { backed: false, name: "" });
    expect(screen.getByRole("button", { name: "Name this grouping" })).toBeTruthy();
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Remove workstream" })).toBeTruthy();
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeTruthy();
    expect(regionNameAction({ clearing: false, taskId: null, task: null, profile: other, cardsInBox: 0 }).action).toBe("create");
  });
  it("a read-only viewer sees none of these", () => {
    renderBox(owner, { editable: false });
    expect(screen.queryByRole("button", { name: "Workstream options" })).toBeNull();
  });
  it("the default is never deletable or renamable", async () => {
    expect(boxRemoval({ custom: false, seeded: true, profile: owner, task: fallback, cardsInBox: 0 }).offer).toBe("none");
    expect(canRenameBox({ backed: true, profile: owner, task: fallback })).toBe(false);
    const { client, deletes } = fakeClient({ id: "t0", is_board_default: true, owner_id: "p1" });
    await expect(deleteWorkstreamRow(client, { taskId: "t0", ownerId: "p1" })).rejects.toThrow(WORKSTREAM_IS_DEFAULT);
    expect(deletes).toEqual([]);
  });
  it("the server refuses a non-owner delete even if the control is bypassed", async () => {
    const { client, deletes } = fakeClient({ id: "t1", is_board_default: false, owner_id: "p1" });
    await expect(deleteWorkstreamRow(client, { taskId: "t1", ownerId: "p2" })).rejects.toThrow(WORKSTREAM_NOT_OWNER);
    expect(deletes).toEqual([]);
    const fn = readFileSync("src/lib/workstreams.functions.ts", "utf8");
    expect(fn).toContain("ownerId: profile.id");
  });
});
