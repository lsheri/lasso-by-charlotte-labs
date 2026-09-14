import { readFileSync } from "fs";
import { join } from "path";

import { describe, expect, it } from "vitest";

import { workspaceStamp } from "../org-type.server";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("pass180 workspace stamp", () => {
  it("org-type cache has a TTL and no longer claims the type is fixed at creation", () => {
    const source = read("src/lib/org-type.server.ts");
    expect(source).toContain("ORG_TYPE_TTL_MS");
    expect(source).not.toContain("changes at most once, at creation");
    expect(source).not.toContain("changes at most once, at workspace creation");
  });

  it("org-type exports workspaceStamp", () => {
    expect(read("src/lib/org-type.server.ts")).toContain("export async function workspaceStamp");
  });

  it("telemetry.server stamps workspace_type in both of its inserts", () => {
    const source = read("src/lib/telemetry.server.ts");
    const occurrences = source.split("workspace_type").length - 1;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("telemetry-v2 stamps workspace_type and selects settings from orgs", () => {
    const source = read("src/lib/telemetry-v2.server.ts");
    expect(source).toContain("workspace_type");
    expect(source).toContain('select("name, data_use_tier, settings")');
  });

  it("workspace_type is a column, never a dim or a prop", () => {
    for (const path of ["src/lib/telemetry.server.ts", "src/lib/telemetry-v2.server.ts"]) {
      const source = read(path);
      expect(source).not.toMatch(/dims:\s*\{[^}]*workspace_type/);
      expect(source).not.toContain('canonicalProps["workspace_type"]');
    }
  });

  it("workspaceStamp stamps a null org as an anonymous view", async () => {
    await expect(workspaceStamp(null)).resolves.toEqual({
      workspace_type: "none",
      affiliated: null,
    });
    await expect(workspaceStamp(undefined)).resolves.toEqual({
      workspace_type: "none",
      affiliated: null,
    });
  });
});
