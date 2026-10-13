import { describe, expect, it } from "vitest";

import { canLeaveBoard, LEAVE_BOARD_COPY, REMOVE_FROM_BOARD_COPY } from "@/lib/leave-board";
import { cardRemovable } from "@/lib/card-removable";
import type { WorkItemRow } from "@/lib/work-types";

describe("canLeaveBoard", () => {
  const seat = { id: "g1", role: "em", is_guest: true };
  it("lets a guest seat on the board leave", () => {
    expect(canLeaveBoard(seat, { profile_id: "g1" })).toBe(true);
  });
  it("never lets a non-guest member leave", () => {
    expect(canLeaveBoard({ id: "m1", role: "em", is_guest: false }, { profile_id: "m1" })).toBe(false);
    expect(canLeaveBoard({ id: "m1", role: "lead" }, { profile_id: "m1" })).toBe(false);
  });
  it("never lets a coach leave", () => {
    expect(canLeaveBoard({ id: "c1", role: "coach", is_guest: true }, { profile_id: "c1" })).toBe(false);
  });
  it("never lets someone with no membership leave", () => {
    expect(canLeaveBoard(seat, null)).toBe(false);
    expect(canLeaveBoard(seat, undefined)).toBe(false);
    expect(canLeaveBoard(seat, { profile_id: "someone-else" })).toBe(false);
    expect(canLeaveBoard(null, { profile_id: "g1" })).toBe(false);
  });
  it("keeps its wording free of em dashes", () => {
    for (const v of [...Object.values(LEAVE_BOARD_COPY), ...Object.values(REMOVE_FROM_BOARD_COPY)]) expect(v).not.toContain("\u2014");
  });
});

/** Mirrors CanvasLabPage's requestHide order: the ownership guard, then the dialog. */
function requestHide(profile: { id: string; role: string }, node: { workItemId?: string; authorProfileId?: string }, item: WorkItemRow | undefined) {
  const calls: string[] = [];
  if (node.workItemId && !cardRemovable(profile, node, item)) { calls.push("announce"); return calls; }
  calls.push("dialog");
  return calls;
}

describe("remove confirmation", () => {
  const me = { id: "p-me", role: "em" };
  it("announces and never opens the dialog for someone else's work", () => {
    expect(requestHide(me, { workItemId: "w", authorProfileId: "p-o" }, { owner_id: "p-o" } as WorkItemRow)).toEqual(["announce"]);
  });
  it("opens the dialog for your own work", () => {
    expect(requestHide(me, { workItemId: "w" }, { owner_id: "p-me" } as WorkItemRow)).toEqual(["dialog"]);
  });
  it("never opens the dialog for a coach", () => {
    expect(requestHide({ id: "p-me", role: "coach" }, { workItemId: "w" }, { owner_id: "p-me" } as WorkItemRow)).toEqual(["announce"]);
  });
});
