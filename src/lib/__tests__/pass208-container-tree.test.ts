import { describe, expect, it } from "vitest";

import {
  MAX_CONTAINER_DEPTH,
  buildContainerTree,
  groupEngagementsByClient,
  type ContainerNode,
  type ContainerRow,
  type NavEngagement,
} from "@/lib/nav-groups";

const row = (id: string, name: string, parent_id: string | null = null, kind: "client" | "folder" = "client"): ContainerRow => ({
  id,
  name,
  kind,
  parent_id,
  quick_folder: false,
});
const eng = (id: string, code: string, clientId: string, name = clientId): NavEngagement => ({
  id,
  code,
  title: id,
  clients: { id: clientId, name, quick_folder: false },
});

function all(nodes: ContainerNode[]): ContainerNode[] {
  return nodes.flatMap((n) => [n, ...all(n.children)]);
}
const countWork = (nodes: ContainerNode[]) => all(nodes).reduce((n, c) => n + c.engagements.length, 0);
const maxDepth = (nodes: ContainerNode[]) => Math.max(...all(nodes).map((n) => n.depth));

describe("buildContainerTree", () => {
  it("flat: three roots, alphabetical, work attached by code", () => {
    const rows = [row("c", "Cedar"), row("a", "Alder"), row("b", "Birch")];
    const work = [eng("e2", "B2", "a"), eng("e1", "A1", "a"), eng("e3", "C1", "b"), eng("e4", "D1", "c")];
    const tree = buildContainerTree(rows, work);
    expect(tree.map((n) => n.name)).toEqual(["Alder", "Birch", "Cedar"]);
    expect(tree.every((n) => n.depth === 0)).toBe(true);
    expect(tree[0]!.engagements.map((e) => e.code)).toEqual(["A1", "B2"]);
    expect(countWork(tree)).toBe(work.length);
  });

  it("one level: folder under a client", () => {
    const work = [eng("e1", "A", "c"), eng("e2", "B", "f")];
    const tree = buildContainerTree([row("f", "Folder", "c", "folder"), row("c", "Client")], work);
    expect(tree).toHaveLength(1);
    expect(tree[0]!.children[0]).toMatchObject({ clientId: "f", depth: 1, kind: "folder" });
    expect(countWork(tree)).toBe(work.length);
  });

  it("two levels", () => {
    const work = [eng("e1", "A", "g")];
    const tree = buildContainerTree([row("c", "C"), row("f", "F", "c"), row("g", "G", "f")], work);
    expect(tree[0]!.children[0]!.children[0]).toMatchObject({ clientId: "g", depth: 2 });
    expect(countWork(tree)).toBe(work.length);
  });

  it("depth cap: a chain of five keeps everything, nothing past the cap", () => {
    const rows = [row("n0", "N0"), row("n1", "N1", "n0"), row("n2", "N2", "n1"), row("n3", "N3", "n2"), row("n4", "N4", "n3")];
    const work = rows.map((r, i) => eng(`e${i}`, `C${i}`, r.id));
    const tree = buildContainerTree(rows, work);
    expect(maxDepth(tree)).toBeLessThanOrEqual(MAX_CONTAINER_DEPTH);
    const ids = all(tree).map((n) => n.clientId).sort();
    expect(ids).toEqual(["n0", "n1", "n2", "n3", "n4"]);
    expect(all(tree).find((n) => n.clientId === "n4")?.depth).toBe(MAX_CONTAINER_DEPTH);
    expect(all(tree).find((n) => n.clientId === "n4")?.engagements).toHaveLength(1);
    expect(countWork(tree)).toBe(work.length);
  });

  it("two-node cycle terminates and keeps both", () => {
    const rows = [row("a", "A", "b"), row("b", "B", "a")];
    const work = [eng("e1", "1", "a"), eng("e2", "2", "b")];
    let tree: ContainerNode[] = [];
    expect(() => (tree = buildContainerTree(rows, work))).not.toThrow();
    expect(all(tree).map((n) => n.clientId).sort()).toEqual(["a", "b"]);
    expect(countWork(tree)).toBe(work.length);
  });

  it("self parent is a root", () => {
    const work = [eng("e1", "1", "s")];
    const tree = buildContainerTree([row("s", "Self", "s")], work);
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({ clientId: "s", depth: 0 });
    expect(countWork(tree)).toBe(work.length);
  });

  it("missing parent is a root, not dropped", () => {
    const work = [eng("e1", "1", "k")];
    const tree = buildContainerTree([row("k", "Kid", "unseen")], work);
    expect(tree.map((n) => n.clientId)).toEqual(["k"]);
    expect(countWork(tree)).toBe(work.length);
  });
});

describe("groupEngagementsByClient regression guard", () => {
  it("output for a fixture is unchanged", () => {
    const fixture: NavEngagement[] = [
      eng("e1", "B1", "b", "Beta"),
      eng("e2", "A1", "a", "Alpha"),
      { id: "e3", code: "Z", title: "none", clients: null },
      { id: "e4", code: "Q", title: "quick", clients: { id: "q", name: "Q", quick_folder: true } },
    ];
    const out = groupEngagementsByClient(fixture);
    expect(out.groups.map((g) => [g.clientId, g.name, g.engagements.map((e) => e.id)])).toEqual([
      ["a", "Alpha", ["e2"]],
      ["b", "Beta", ["e1"]],
      ["__internal__", "Internal", ["e3"]],
      ["__unmapped__", "Unmapped", ["e4"]],
    ]);
    expect(out.flat).toEqual([]);
  });
});
