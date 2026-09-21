import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("pass 152 · one work note", () => {
  it("owns the sticky paper in one component", () => {
    const note = read("src/components/work/WorkNote.tsx");
    // The note owns the paper class and still passes the caller's own class
    // through. Anything else the expression carries is free to change.
    expect(note).toMatch(/className=\{`nb-paper [^`]*\$\{className\}`\}/);
    expect(note).toContain("notePaper(item.id)");
    expect(note).toContain("noteHue(colourKey(");
    expect(note).toContain("workIdentityLabel(item)");
    expect(note).not.toContain("sourceLabel(item.source)");
    expect(note).toContain("formatDate(effectiveWorkDate(item))");
  });

  it("routes every requested surface through WorkNote", () => {
    for (const path of [
      "src/components/work/WorkRow.tsx",
      "src/components/overview/ChatsToOrganise.tsx",
      "src/components/engagements/EngagementCanvas.tsx",
    ]) {
      const source = read(path);
      expect(source).toContain('import { WorkNote } from "@/components/work/WorkNote"');
      expect(source).toContain("<WorkNote");
      expect(source).not.toContain('className="nb-paper"');
      expect(source).not.toContain('className="nb-paper-body"');
    }
  });

  it("keeps board interaction state on the canvas wrapper", () => {
    const canvas = read("src/components/engagements/EngagementCanvas.tsx");
    for (const contract of [
      "cardRefs.current.set(cardId, node)",
      'aria-roledescription="Draggable card"',
      "aria-grabbed={lifted}",
      'data-lifted={lifted ? "true" : "false"}',
      "onCardKeyDown(e, pos, cardId)",
      "beginPointer(e, pos, cardId, false)",
      "if (movedRef.current)",
    ]) {
      expect(canvas).toContain(contract);
    }
    expect(canvas).toContain('className="nb-canvas-card min-w-0 flex-1 text-left"');
  });
});