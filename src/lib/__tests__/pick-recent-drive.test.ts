/**
 * PICK-RECENT-1: the picker's Recent scope lists the whole drive newest
 * first, while the folder mode keeps its exact query and ordering.
 */
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { buildDriveQuery, SCOPE_LABEL, scopeAvailable } from "@/lib/drive-scope";

const composio = readFileSync("src/lib/composio.server.ts", "utf8");
const picker = readFileSync("src/components/connectors/ConnectorPicker.tsx", "utf8");

describe("PICK-RECENT-1 the recent scope", () => {
  it("sends no parent filter and keeps the trashed clause", () => {
    const query = buildDriveQuery({ scope: "recent" });
    expect(query.q).toContain("trashed = false");
    expect(query.q).not.toContain("in parents");
    expect(query.corpora).toBe("user");
    expect(query.supportsAllDrives).toBe(true);
    expect(query.includeItemsFromAllDrives).toBe(true);
  });

  it("still narrows by kind and age inside the recent scope", () => {
    const query = buildDriveQuery({
      scope: "recent",
      typeFilter: "pdfs",
      ageFilter: "30d",
      now: new Date("2026-09-04T00:00:00.000Z"),
    });
    expect(query.q).toContain("mimeType = 'application/pdf'");
    expect(query.q).toContain("modifiedTime > '2026-08-05T00:00:00.000Z'");
    expect(query.q).not.toContain("in parents");
  });

  it("is always available and labelled Recent", () => {
    expect(scopeAvailable("recent", false)).toBe(true);
    expect(SCOPE_LABEL["recent"]).toBe("Recent");
  });

  it("orders recent by modifiedTime desc, folder mode unchanged", () => {
    expect(composio).toContain(
      'orderBy: opts.scope === "recent" || opts.search?.trim() ? "modifiedTime desc" : "folder,modifiedTime desc"',
    );
    const folder = buildDriveQuery({ scope: "my_drive" });
    expect(folder.q).toContain("'root' in parents");
  });

  it("opens the picker on Recent for googledrive", () => {
    expect(picker).toContain('useState<DriveScope>("recent")');
    expect(picker).toContain('setScope("recent");');
  });
});
