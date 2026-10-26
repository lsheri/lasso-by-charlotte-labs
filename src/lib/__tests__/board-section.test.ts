import { describe, expect, it } from "vitest";

import { regionIsPaint, regionIsWorkstream, regionOccupies } from "@/lib/board-region";
import {
  SECTION_FRAME_PREFIX, SECTION_REMOVED_LINE, SECTION_TITLE_PLACEHOLDER,
  containingSection, isSectionFrameId, moveSectionContents, newSectionFrameId,
  sectionDragMembers, sectionDragSnapshot, sectionTitle,
} from "@/lib/board-section";

const section = { id: "section:main", x: 100, y: 80, width: 400, height: 300 };
const inside = { id: "workstream:inside", x: 140, y: 120, width: 200, height: 160 };
const outside = { id: "workstream:outside", x: 600, y: 120, width: 200, height: 160 };
const filed = { id: "filed", x: 700, y: 500, width: 100, height: 60, frame: inside.id };
const loose = { id: "loose", x: 150, y: 130, width: 100, height: 60, frame: null };

describe("section furniture", () => {
  it("uses a separate prefix and rejects other or missing ids", () => {
    expect(SECTION_FRAME_PREFIX).toBe("section:");
    expect(newSectionFrameId("main")).toBe("section:main");
    expect(isSectionFrameId("section:main")).toBe(true);
    for (const id of [null, undefined, "lane:main", "region:main", "main"]) expect(isSectionFrameId(id)).toBe(false);
  });

  it("trims titles and leaves an empty title unnamed", () => {
    expect(sectionTitle("  Pricing  ")).toBe("Pricing");
    for (const label of [null, undefined, "", "   "]) expect(sectionTitle(label)).toBeNull();
    expect(SECTION_TITLE_PLACEHOLDER).toBe("Name this section");
    expect(SECTION_REMOVED_LINE).toBe("Section removed. Workstreams and cards stay where they are.");
  });

  it("is not a workstream, not paint and does not occupy board space when named", () => {
    const named = { id: section.id, label: "Pricing" };
    expect(regionIsWorkstream(named)).toBe(false);
    expect(regionIsPaint(named)).toBe(false);
    expect(regionOccupies(named)).toBe(false);
  });

  it("takes a frame by its centre and includes its filed cards even with centres outside", () => {
    const snapshot = sectionDragSnapshot(section, [inside, outside], [filed, loose]);
    expect(snapshot.frames).toEqual([{ id: inside.id, offsetX: 40, offsetY: 40 }]);
    expect(snapshot.cards).toEqual([
      { id: filed.id, offsetX: 600, offsetY: 420 },
      { id: loose.id, offsetX: 50, offsetY: 50 },
    ]);
  });

  it("does not take an inside-centre card filed in an outside frame: filing extends inclusion only for member frames", () => {
    const card = { ...loose, frame: outside.id };
    expect(sectionDragSnapshot(section, [inside, outside], [card]).cards).toEqual([]);
  });

  it("never takes a nested section or a card filed in that section", () => {
    const nested = { ...inside, id: "section:nested" };
    expect(sectionDragSnapshot(section, [nested], [{ ...loose, frame: nested.id }])).toEqual({ frames: [], cards: [] });
  });

  it("moves both lists by the section origin and leaves nonmembers and original lists unchanged", () => {
    const frames = [inside, outside];
    const cards = [filed, loose, { ...loose, id: "outside-card", frame: outside.id }];
    const snapshot = sectionDragSnapshot(section, frames, cards);
    const moved = moveSectionContents(frames, cards, snapshot, { x: 200, y: 180 });
    expect(moved.frames[0]).toEqual({ ...inside, x: 240, y: 220 });
    expect(moved.frames[1]).toBe(outside);
    expect(moved.cards[0]).toEqual({ ...filed, x: 800, y: 600 });
    expect(moved.cards[1]).toEqual({ ...loose, x: 250, y: 230 });
    expect(moved.cards[2]).toBe(cards[2]);
    expect(inside.x).toBe(140);
    expect(filed.x).toBe(700);
  });

  it("chooses the smallest overlapping section using a point or rect centre and returns null outside all", () => {
    const small = { id: "section:small", x: 120, y: 100, width: 100, height: 100 };
    expect(containingSection({ x: 170, y: 150 }, [section, small])).toBe(small);
    expect(containingSection({ x: 70, y: 50, width: 200, height: 200 }, [section, small])).toBe(small);
    expect(containingSection({ x: 0, y: 0 }, [section, small])).toBeNull();
    expect(containingSection({ x: 170, y: 150 }, [])).toBeNull();
  });

  it("breaks equal-area ties by the nearest title corner", () => {
    const nearer = { id: "section:nearer", x: 130, y: 110, width: 400, height: 300 };
    expect(containingSection({ x: 200, y: 180 }, [section, nearer])).toBe(nearer);
  });
  it("SEC-FIX-1: a section drag of 120,80 moves the outline and inside cards, including lane-filed chats, and nothing else", () => {
    const sec = { id: "section:fix", x: 100, y: 100, width: 600, height: 400 };
    const ws = { id: "workstream:away", x: 900, y: 100, width: 300, height: 200 };
    const chat = { id: "chat", x: 150, y: 150, width: 100, height: 60, frame: "foundation" };
    const file = { id: "file", x: 400, y: 300, width: 100, height: 60, frame: null };
    const piece = { id: "piece", x: 160, y: 220, width: 100, height: 60, frame: null };
    const wsCard = { id: "ws-card", x: 950, y: 150, width: 100, height: 60, frame: ws.id };
    const away = { id: "away", x: 1300, y: 700, width: 100, height: 60, frame: null };
    const frames = [sec, ws];
    const nodes = [chat, file, piece, wsCard, away];
    const snapshot = sectionDragMembers(sec, frames, nodes, new Set(["piece"]));
    expect(snapshot.cards.map((card) => card.id)).not.toContain("piece");
    const to = { x: sec.x + 120, y: sec.y + 80 };
    const moved = moveSectionContents(frames, nodes, snapshot, to);
    const outline = moved.frames.map((frame) => frame.id === sec.id ? { ...frame, x: to.x, y: to.y } : frame);
    const at = (id: string) => moved.cards.find((card) => card.id === id);
    expect(outline[0]).toMatchObject({ x: 220, y: 180 });
    expect(at("chat")).toMatchObject({ x: 270, y: 230, frame: "foundation" });
    expect(at("file")).toMatchObject({ x: 520, y: 380 });
    expect(at("ws-card")).toBe(wsCard);
    expect(at("away")).toBe(away);
    expect(outline[1]).toBe(ws);
  });
});