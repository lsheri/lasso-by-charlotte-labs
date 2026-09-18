import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// Route regression for the 2026-09-18 correction: /engagements/$id/canvas-lab
// must be a direct child of the authenticated layout, never of the engagement
// detail route (which renders EngagementPage with no Outlet and would swallow
// the child route).

const root = resolve(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("canvas lab route parentage", () => {
  it("keeps the public URL /engagements/$id/canvas-lab on the standalone route file", () => {
    const source = read("routes/_authenticated/engagements.$id_.canvas-lab.tsx");
    expect(source).toContain(
      'createFileRoute("/_authenticated/engagements/$id_/canvas-lab")',
    );
    expect(source).toContain("CanvasLabPage");
  });

  it("parents the route to the authenticated layout in the generated tree", () => {
    const tree = read("routeTree.gen.ts");
    const block = tree.match(
      /'\/_authenticated\/engagements\/\$id_\/canvas-lab': \{[\s\S]*?\}/,
    );
    expect(block).not.toBeNull();
    expect(block![0]).toContain("path: '/engagements/$id/canvas-lab'");
    expect(block![0]).toContain("fullPath: '/engagements/$id/canvas-lab'");
    expect(block![0]).toContain("parentRoute: typeof AuthenticatedRouteRoute");
    expect(block![0]).not.toContain("EngagementsIdRoute");
  });

  it("leaves the engagement detail route with no nested children", () => {
    const tree = read("routeTree.gen.ts");
    // The old nested file must be gone entirely.
    expect(tree).not.toContain("engagements.$id.canvas-lab");
    // No children table may exist for the engagement detail route.
    expect(tree).not.toMatch(/EngagementsIdRouteChildren/);
    // The engagement detail route itself is untouched.
    expect(tree).toContain("path: '/engagements/$id'");
  });
});
