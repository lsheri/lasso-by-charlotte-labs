import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { EngagementRow } from "@/lib/engagement-page-shared";
import { isSharedSpace } from "@/lib/shared-space";

describe("SH-7a: the shared-space band is reachable", () => {
  it("ENGAGEMENT_SELECT selects org_id", () => {
    const server = readFileSync("src/lib/engagement-page.server.ts", "utf8");
    const select = server.match(/ENGAGEMENT_SELECT\s*=\s*\n?\s*"([^"]+)"/);
    expect(select).not.toBeNull();
    const columns = select![1]!.split(",").map((c) => c.trim());
    expect(columns).toContain("org_id");
  });

  it("EngagementRow carries org_id", () => {
    const row: EngagementRow = {
      id: "e1",
      org_id: "org-host",
      code: "CS",
      title: "CS Program Recommendation",
      client_label: null,
      client_id: null,
      clients: null,
      brief: null,
      brief_by: null,
      term_label: null,
    };
    expect(row.org_id).toBe("org-host");
  });

  it("the band condition is true across workspaces and false within one", () => {
    expect(isSharedSpace("org-host", "org-mine")).toBe(true);
    expect(isSharedSpace("org-mine", "org-mine")).toBe(false);
    expect(isSharedSpace(null, "org-mine")).toBe(false);
    expect(isSharedSpace("org-host", undefined)).toBe(false);
  });

  it("CanvasLabPage reads org_id without a cast and uses the helper", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("const boardOrgId = engagement?.org_id ?? null;");
    expect(page).not.toContain("as { org_id?");
    expect(page).toContain("isSharedSpace(boardOrgId, profile?.org_id)");
  });
});
