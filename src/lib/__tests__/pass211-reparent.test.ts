import { describe, expect, it } from "vitest";

import { MAX_CONTAINER_DEPTH, eligibleParents, type ContainerRow } from "@/lib/nav-groups";

const r = (id: string, parent_id: string | null = null, extra: Partial<ContainerRow> = {}): ContainerRow => ({
  id, name: id, kind: "client", parent_id, ...extra,
});
const ids = (rows: ContainerRow[]) => rows.map((x) => x.id);

describe("pass 211 eligibleParents", () => {
  it("flat roots: others eligible, self not", () => {
    expect(ids(eligibleParents([r("a"), r("b"), r("c")], "a"))).toEqual(["b", "c"]);
  });
  it("refuses every descendant (cycle refusal)", () => {
    const out = ids(eligibleParents([r("a"), r("b", "a"), r("c", "b"), r("d")], "a"));
    expect(out).not.toContain("b");
    expect(out).not.toContain("c");
    expect(out).toEqual(["d"]);
  });
  it("two-node case: a cannot move under its child b", () => {
    expect(ids(eligibleParents([r("a"), r("b", "a")], "a"))).toEqual([]);
  });
  it("depth budget counts the moving subtree height", () => {
    expect(MAX_CONTAINER_DEPTH).toBe(3);
    const rows = [r("m"), r("m1", "m"), r("m2", "m1"), r("x"), r("y", "x"), r("z", "y")];
    const out = ids(eligibleParents(rows, "m"));
    expect(out).not.toContain("z");
    expect(out).not.toContain("y");
    expect(out).toContain("x");
  });
  it("never offers a quick folder", () => {
    expect(ids(eligibleParents([r("a"), r("q", null, { quick_folder: true })], "a"))).toEqual([]);
  });
  it("terminates on a pre-existing cycle", () => {
    const out = eligibleParents([r("a"), r("b", "c"), r("c", "b")], "a");
    expect(ids(out)).toEqual(["b", "c"]);
  });
});
