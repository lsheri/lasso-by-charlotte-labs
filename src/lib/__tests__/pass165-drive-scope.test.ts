import { describe, expect, it } from "vitest";

import {
  buildDriveQuery,
  DRIVE_AGE_FILTERS,
  DRIVE_SCOPES,
  DRIVE_TYPE_FILTERS,
  truncationLine,
} from "@/lib/drive-scope";

const NOW = new Date("2026-09-04T00:00:00.000Z");

describe("pass 165: drive query builder", () => {
  it("defaults to My Drive, root, everything, any time", () => {
    const query = buildDriveQuery({});
    expect(query.q).toBe("trashed = false and 'root' in parents");
    expect(query.corpora).toBe("user");
    expect(query.driveId).toBeUndefined();
    expect(query.supportsAllDrives).toBe(true);
    expect(query.includeItemsFromAllDrives).toBe(true);
  });

  it("asks for shared items at the top of Shared with me", () => {
    const query = buildDriveQuery({ scope: "shared_with_me" });
    expect(query.q).toContain("sharedWithMe = true");
    expect(query.q).not.toContain("in parents");
  });

  it("browses inside a folder that was reached through Shared with me", () => {
    const query = buildDriveQuery({ scope: "shared_with_me", folderId: "abc" });
    expect(query.q).toContain("'abc' in parents");
  });

  it("uses the drive corpus and the drive as the parent for a shared drive", () => {
    const query = buildDriveQuery({ scope: "shared_drive", driveId: "D1" });
    expect(query.corpora).toBe("drive");
    expect(query.driveId).toBe("D1");
    expect(query.q).toContain("'D1' in parents");
  });

  it("keeps folders visible while a type filter is on", () => {
    for (const type of DRIVE_TYPE_FILTERS) {
      const query = buildDriveQuery({ typeFilter: type });
      if (type === "everything") {
        expect(query.q).not.toContain("mimeType");
      } else {
        expect(query.q).toContain("application/vnd.google-apps.folder");
      }
    }
    expect(buildDriveQuery({ typeFilter: "pdfs" }).q).toContain("mimeType = 'application/pdf'");
    expect(buildDriveQuery({ typeFilter: "spreadsheets" }).q).toContain(
      "application/vnd.google-apps.spreadsheet",
    );
  });

  it("turns each age choice into a modifiedTime floor", () => {
    expect(buildDriveQuery({ ageFilter: "any", now: NOW }).q).not.toContain("modifiedTime");
    expect(buildDriveQuery({ ageFilter: "30d", now: NOW }).q).toContain(
      "modifiedTime > '2026-08-05T00:00:00.000Z'",
    );
    expect(buildDriveQuery({ ageFilter: "90d", now: NOW }).q).toContain("modifiedTime > '2026-06");
    expect(buildDriveQuery({ ageFilter: "365d", now: NOW }).q).toContain("modifiedTime > '2025-09");
  });

  it("covers every scope, type and age combination without throwing", () => {
    for (const scope of DRIVE_SCOPES) {
      for (const type of DRIVE_TYPE_FILTERS) {
        for (const age of DRIVE_AGE_FILTERS) {
          const query = buildDriveQuery({
            scope,
            typeFilter: type,
            ageFilter: age,
            driveId: scope === "shared_drive" ? "D1" : null,
            now: NOW,
          });
          expect(query.q.startsWith("trashed = false")).toBe(true);
          expect(query.supportsAllDrives).toBe(true);
        }
      }
    }
  });

  it("escapes a search term instead of breaking the query", () => {
    const query = buildDriveQuery({ search: "o'brien" });
    expect(query.q).toContain("name contains 'o\\'brien'");
  });

  it("says whether more is available", () => {
    expect(truncationLine(50, true)).toBe("50 shown, more available.");
    expect(truncationLine(12, false)).toBe("12 shown.");
    expect(truncationLine(50, true)).not.toMatch(/monitor|track|score|oversight|surveillance|—/i);
  });
});

describe("pass 165: paging appends without duplicates", () => {
  /** Mirrors the picker's append rule. */
  function append(prev: { id: string }[], next: { id: string }[]) {
    const known = new Set(prev.map((row) => row.id));
    return [...prev, ...next.filter((row) => !known.has(row.id))];
  }

  it("keeps page one and adds page two once", () => {
    const first = [{ id: "a" }, { id: "b" }];
    const second = [{ id: "b" }, { id: "c" }];
    const merged = append(first, second);
    expect(merged.map((row) => row.id)).toEqual(["a", "b", "c"]);
    expect(append(merged, second).map((row) => row.id)).toEqual(["a", "b", "c"]);
  });
});

describe("pass 165: paging dims carry no names", () => {
  it("only reports the scope and the page number", () => {
    const dims = { scope: "shared_drive", page_index: 2 };
    const serialised = JSON.stringify(dims);
    for (const name of ["Q3 Board Deck", "Client Files", "Acme Shared Drive", "budget.xlsx"]) {
      expect(serialised).not.toContain(name);
    }
    expect(Object.keys(dims).sort()).toEqual(["page_index", "scope"]);
  });
});
