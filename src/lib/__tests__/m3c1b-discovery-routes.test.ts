import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { routeTree } from "@/routeTree.gen";
import { getRouter } from "@/router";

function collectFullPaths(): string[] {
  // Route instances are lazily initialised; building the router walks and
  // initialises the tree, after which every route object carries fullPath.
  const router = getRouter();
  void routeTree;
  const out: string[] = [];
  for (const route of Object.values(router.routesById)) {
    const fullPath = (route as { fullPath?: string }).fullPath;
    if (typeof fullPath === "string") out.push(fullPath);
  }
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    out.push(full);
    if (statSync(full).isDirectory()) walk(full, out);
  }
  return out;
}

describe("M3-C1b OAuth discovery routes", () => {
  it("registers the discovery paths in the generated route tree", () => {
    const paths = collectFullPaths();
    expect(paths).toContain("/.well-known/oauth-protected-resource");
    expect(paths).toContain("/.well-known/oauth-protected-resource/api/mcp");
    expect(paths).toContain("/api/oauth-protected-resource");
    expect(paths).toContain("/api/mcp");
    expect(paths).toContain("/api/mcp/$token");
  });

  it("has no file or folder under src/routes whose name starts with a dot", () => {
    const entries = walk(join(process.cwd(), "src", "routes"));
    const dotted = entries.filter((e) => e.split("/").pop()!.startsWith("."));
    expect(dotted).toEqual([]);
  });
});
