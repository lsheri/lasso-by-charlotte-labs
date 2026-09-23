import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  driveReferenceMatch,
  isGoogleNative,
  nextPickSelection,
  placeholderExportTarget,
} from "@/lib/reference-file-shared";
import { guardWorkboardEvent } from "@/lib/workboard-event-allowlist";

const fns = readFileSync("src/lib/reference-file.functions.ts", "utf8");
const helper = readFileSync("src/lib/reference-file.server.ts", "utf8");
const card = readFileSync("src/components/canvas-lab/ReferenceFileCard.tsx", "utf8");
const picker = readFileSync("src/components/connectors/ConnectorPicker.tsx", "utf8");

describe("C2 shared completion", () => {
  it("both functions call the one helper", () => {
    const calls = fns.match(/return completeReference\(/g) ?? [];
    expect(calls.length).toBe(2);
    expect(fns).toContain('bytes: { kind: "stored", path: data.path }');
    expect(fns).toContain('kind: "fetch"');
    expect(helper).toContain('source_event: "reference_completed"');
    expect(helper).toContain('eventType: "workboard.reference_file_added"');
  });

  it("wraps the Drive path in guardConnector and requireConnected, reusing fetchDriveFileBytes", () => {
    expect(fns).toContain('guardConnector(supabase, { provider: "googledrive"');
    expect(fns).toContain('requireConnected(supabase, profile.id, "googledrive")');
    expect(fns).toContain("fetchDriveFileBytes(");
    expect(fns).toContain("storeFile(userId");
  });
});

describe("C2 export format", () => {
  it("maps Google-native files to the placeholder formats", () => {
    expect(placeholderExportTarget("application/vnd.google-apps.presentation").ext).toBe("pptx");
    expect(placeholderExportTarget("application/vnd.google-apps.document").ext).toBe("docx");
    expect(placeholderExportTarget("application/vnd.google-apps.spreadsheet").ext).toBe("xlsx");
    expect(placeholderExportTarget("application/vnd.google-apps.drawing").ext).toBe("pdf");
    expect(isGoogleNative("application/vnd.google-apps.document")).toBe(true);
    expect(isGoogleNative("application/pdf")).toBe(false);
  });

  it("match is unknown for exports, compared normally for binary files", () => {
    expect(driveReferenceMatch("abc", "abc", true)).toBe("unknown");
    expect(driveReferenceMatch("abc", "abc", false)).toBe("yes");
    expect(driveReferenceMatch("abc", "def", false)).toBe("no");
  });

  it("records source_meta.drive_file_id and never meta.drive_file_id", () => {
    expect(fns).toContain("extraSourceMeta: { drive_file_id: data.drive_file_id }");
    expect(helper).toContain("source_meta: nextMeta");
    expect(helper).not.toMatch(/\bmeta:\s*\{[^}]*drive_file_id/);
    expect(fns).not.toMatch(/\bmeta:\s*\{[^}]*drive_file_id/);
  });
});

describe("C2 card and picker", () => {
  it("From Drive shows only when Drive is connected, opened from a click", () => {
    expect(card).toContain('accounts?.["googledrive"]?.status === "connected"');
    expect(card).toContain("{driveConnected && !added ? (");
    expect(card).toContain("setDriveOpen(true)");
    expect(card).toContain("onPickFile={addFromDrive}");
  });

  it("single-pick keeps one file and refuses folders", () => {
    const a = nextPickSelection(new Set(), "a", true);
    const b = nextPickSelection(a, "b", true);
    expect(Array.from(b)).toEqual(["b"]);
    expect(nextPickSelection(b, "b", true).size).toBe(0);
    expect(Array.from(nextPickSelection(a, "b", false)).sort()).toEqual(["a", "b"]);
    expect(picker).toContain("r.id === id && !r.isFolder");
    expect(picker).toContain("selected.size !== 1");
    expect(picker).toContain("REFERENCE_DRIVE_CONFIRM");
  });

  it("keeps via drive on reference_file_added", () => {
    const out = guardWorkboardEvent("workboard.reference_file_added", {
      matched: "unknown",
      via: "drive",
      text: "x",
    });
    expect(out).toMatchObject({ keep: true, dims: { matched: "unknown", via: "drive" } });
    expect(JSON.stringify(out)).not.toContain('"text"');
  });
});
