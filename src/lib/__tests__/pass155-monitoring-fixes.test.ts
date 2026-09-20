import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

/**
 * Three Project monitoring fixes, pinned so they stay fixed:
 * 1. opening a note refreshes the full notes list, so the circle leaves at once
 * 2. a quick-folder engagement keeps its send path on the Share tab
 * 3. the Connect-to-work sheet closes itself before settings opens, on MCP
 */
describe("monitoring fixes", () => {
  it("refreshes the notes page rows when a note is marked read", () => {
    const modal = read("src/components/coaching/CoachNoteModal.tsx");
    expect(modal).toContain('["notes-about-me-all", profile.id]');
    // Both invalidations ride the same read mark; neither replaces the other.
    expect(modal).toContain("unreadNotesKey(profile.id)");
    expect(modal).toContain("Promise.all(");
  });

  it("keeps the send path on a quick folder's Share tab", () => {
    const share = read("src/components/engagements/SharedWithSection.tsx");
    // The quick-folder early branch uses the same ShipBlock as the normal tab.
    expect(share).toContain("function ShipBlock");
    expect(share.match(/<ShipBlock/g)?.length).toBe(2);
    const quick = share.slice(share.indexOf("if (quickFolder)"));
    expect(quick).toContain("<ShipBlock");
    expect(quick).toContain("SEND TO THE FIRM");
    expect(quick).toContain("<CanvasDeliverableActions");
  });

  it("closes the sheet and lands settings on MCP", () => {
    const sheet = read("src/components/engagements/ConnectToWorkSheet.tsx");
    // Order matters: the sheet is modal, so it must close before settings opens.
    const open = sheet.indexOf("setOpen(false)");
    const settings = sheet.indexOf('openSettings("mcp", "connect_sheet")');
    expect(open).toBeGreaterThan(-1);
    expect(settings).toBeGreaterThan(open);
    expect(sheet).not.toContain('openSettings("connectors", "connect_sheet")');
  });
});
