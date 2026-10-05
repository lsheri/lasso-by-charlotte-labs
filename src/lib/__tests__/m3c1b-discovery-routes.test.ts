import { describe, expect, it } from "vitest";
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { routeTree } from "@/routeTree.gen";

function collectFullPaths(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  const rec = node as Record<string, unknown>;
  if (typeof rec.fullPath === "string") out.push(rec.fullPath);
  const children = rec.children;
  if (children && typeof children === "object") {
    for (const child of Object.values(children)) collectFullPaths(child, out);
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
    const paths = collectFullPaths(routeTree);
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
