import { describe, expect, it, vi } from "vitest";

import { vocabFor } from "@/lib/edu-vocab";
import type { ContainerRow } from "@/lib/nav-groups";
import type { OrgType } from "@/lib/org-type";
import {
  applyContainerMoves,
  canDropOn,
  isSelfOrDescendant,
  performDrop,
  type PendingMoves,
} from "@/lib/sidebar-drag";

// The live shape: ABC co > folder 01 > folder1, plus a root test folder.
const rows: ContainerRow[] = [
  { id: "abc", name: "ABC co", kind: "client", parent_id: null, quick_folder: false },
  { id: "f01", name: "folder 01", kind: "folder", parent_id: "abc", quick_folder: false },
  { id: "f1", name: "folder1", kind: "folder", parent_id: "f01", quick_folder: false },
  { id: "t", name: "test", kind: "folder", parent_id: null, quick_folder: false },
];

// Exhaustive over the union: adding an OrgType without adding it here fails typecheck.
const ORG_TYPES = { company: true, partner: true, personal: true, edu: true } satisfies Record<OrgType, true>;

describe("Unit 4e self and descendant refusal", () => {
  it("detects self, child and grandchild, not siblings or parents", () => {
    expect(isSelfOrDescendant(rows, "abc", "abc")).toBe(true);
    expect(isSelfOrDescendant(rows, "abc", "f01")).toBe(true);
    expect(isSelfOrDescendant(rows, "abc", "f1")).toBe(true);
    expect(isSelfOrDescendant(rows, "f1", "abc")).toBe(false);
    expect(isSelfOrDescendant(rows, "t", "abc")).toBe(false);
  });

  it("refuses the target before any call is made", async () => {
    const calls = { reparent: vi.fn(), moveWorkboard: vi.fn(), log: vi.fn() };
    const setPending = vi.fn();
    const ok = await performDrop({
      item: { type: "container", id: "f01", kind: "folder" },
      target: { type: "container", id: "f1" },
      rows, calls, setPending, onRefused: vi.fn(),
    });
    expect(ok).toBe(false);
    expect(calls.reparent).not.toHaveBeenCalled();
    expect(setPending).not.toHaveBeenCalled();
  });

  it("leaves depth rules to the database: a fourth level is still a valid target here", () => {
    expect(canDropOn(rows, { type: "container", id: "t", kind: "folder" }, { type: "container", id: "f1" })).toBe(true);
  });
});

describe("Unit 4e optimistic move and revert", () => {
  it("shows the move, reverts on refusal, shows the database's words, fires no event", async () => {
    let pending: PendingMoves = {};
    const seen: PendingMoves[] = [];
    const setPending = (u: (p: PendingMoves) => PendingMoves) => { pending = u(pending); seen.push(pending); };
    const sentence = "Folders go three deep. Move this one higher up, or put the work straight on a workboard";
    const onRefused = vi.fn();
    const calls = {
      reparent: vi.fn(async () => {
        expect(applyContainerMoves(rows, pending).find((r) => r.id === "t")?.parent_id).toBe("f1");
        throw new Error(sentence);
      }),
      moveWorkboard: vi.fn(),
      log: vi.fn(),
    };
    const ok = await performDrop({
      item: { type: "container", id: "t", kind: "folder" },
      target: { type: "container", id: "f1" },
      rows, calls, setPending, onRefused,
    });
    expect(ok).toBe(false);
    expect(seen[0]).toEqual({ "container:t": "f1" });
    expect(pending).toEqual({});
    expect(onRefused).toHaveBeenCalledWith(sentence);
    expect(calls.log).not.toHaveBeenCalled();
  });

  it("sends the exact dims on success", async () => {
    const log = vi.fn();
    const noop = () => {};
    await performDrop({ item: { type: "container", id: "t", kind: "folder" }, target: { type: "container", id: "abc" }, rows,
      calls: { reparent: vi.fn(async () => {}), moveWorkboard: vi.fn(), log }, setPending: noop, onRefused: vi.fn() });
    await performDrop({ item: { type: "workboard", id: "w", clientId: "abc" }, target: { type: "top" }, rows,
      calls: { reparent: vi.fn(), moveWorkboard: vi.fn(async () => {}), log }, setPending: noop, onRefused: vi.fn() });
    expect(log.mock.calls).toEqual([
      ["container.reparented", { kind: "folder", depth: 1, action: "drag" }],
      ["engagement.updated", { moved: "true", to_container: "false", from: "drag" }],
    ]);
  });
});

describe("Unit 4e drag in every product type", () => {
  for (const type of Object.keys(ORG_TYPES) as OrgType[]) {
    it(`${type}: the same moves are allowed and refused`, async () => {
      expect(vocabFor({ org_type: type } as never).client).toBeTruthy();
      const moveWorkboard = vi.fn(async () => {});
      const ok = await performDrop({ item: { type: "workboard", id: "w", clientId: null }, target: { type: "container", id: "f1" }, rows,
        calls: { reparent: vi.fn(), moveWorkboard, log: vi.fn() }, setPending: () => {}, onRefused: vi.fn() });
      expect(ok).toBe(true);
      expect(moveWorkboard).toHaveBeenCalledWith({ engagementId: "w", clientId: "f1" });
      expect(canDropOn(rows, { type: "container", id: "abc", kind: "client" }, { type: "container", id: "f1" })).toBe(false);
    });
  }
});
