/**
 * SECD-1a: a section's marker passes all four doors.
 *
 * Mock block for the public-link path copied from
 * src/lib/__tests__/sh3c1-public-link-no-turns.test.ts (the newest passing
 * readBoard test). The server check follows canvas-lab-frame-guards.test.ts,
 * which imports canvas-lab.server directly with no mocks.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: async () => undefined }));
vi.mock("../telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: async () => undefined }));

import { applyDurableBoard } from "@/components/canvas-lab/canvas-lab-model";
import { readBoard } from "@/lib/board-share-open.server";
import { validateFrameMarker } from "@/lib/canvas-lab.server";
import type { WorkboardDto, WorkboardFrameDto } from "@/lib/canvas-lab-shared";
import {
  clearMarker,
  dayOf,
  markerLabel,
  monthOf,
  setNumberMarker,
  setPeriodMarker,
  shift,
  weekOf,
} from "@/lib/board-section";
import { addedLabel, grownSuffix } from "@/lib/push-boundary";

const frameBase = { kind: "custom" as const, taskId: null, label: "Sprint", fill: null, x: 0, y: 0, w: 600, h: 400, version: 1 };
const periodFrame: WorkboardFrameDto = { ...frameBase, id: "f-1", key: "section:a", ord: 0, periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null };
const numberFrame: WorkboardFrameDto = { ...frameBase, id: "f-2", key: "section:b", ord: 1, periodStart: null, periodEnd: null, sequenceNo: 2 };

function durableBoard(frames: WorkboardFrameDto[]): WorkboardDto {
  return {
    id: "wb-1",
    engagementId: "e-1",
    version: 1,
    frames,
    nodes: [],
    links: [],
    viewerProfileId: "p-1",
    canEditStructure: true,
    archivedContextFrame: null,
  };
}

function fakeDb(frameRows: unknown[]) {
  const data: Record<string, unknown> = {
    workboards: { id: "wb-1", engagement_id: "e-1", version: 1 },
    engagements: { id: "e-1", org_id: "org-1", brief: "Brief" },
    workboard_frames: frameRows,
    workboard_nodes: [],
    workboard_links: [],
    decisions: [],
    tasks: [],
    turns: [],
    work_item_extracts: [],
    document_versions: [],
  };
  return {
    from(table: string) {
      const rows = data[table] ?? [];
      const builder: Record<string, unknown> & { maybeSingle?: unknown; then?: unknown } = {};
      for (const m of ["select", "eq", "is", "in", "order", "limit", "not"]) builder[m] = () => builder;
      builder.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return builder;
    },
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: "none" } }) }) },
  };
}

const NOW = new Date(2026, 9, 26);

describe("SECD-1a reload: the marker survives the trip back", () => {
  it("applyDurableBoard keeps a period and a number on their sections", () => {
    const merged = applyDurableBoard({ frames: [], nodes: [] }, durableBoard([periodFrame, numberFrame]));
    const a = merged.frames.find((f) => f.id === "section:a");
    const b = merged.frames.find((f) => f.id === "section:b");
    expect(a).toMatchObject({ periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null });
    expect(b).toMatchObject({ periodStart: null, periodEnd: null, sequenceNo: 2 });
  });

  it("the public link's frames carry the marker too", async () => {
    const row = (f: WorkboardFrameDto) => ({
      id: f.id, key: f.key, kind: f.kind, task_id: null, label: f.label, fill: null,
      x: 0, y: 0, w: 600, h: 400, ord: f.ord, version: 1, deleted_at: null,
      period_start: f.periodStart, period_end: f.periodEnd, sequence_no: f.sequenceNo,
    });
    const dto = await readBoard(fakeDb([row(periodFrame), row(numberFrame)]) as never, "wb-1", { org_id: "org-1", expires_at: "2099-01-01T00:00:00Z" }, null);
    const frames = dto?.board.frames ?? [];
    expect(frames.find((f) => f.key === "section:a")).toMatchObject({ periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null });
    expect(frames.find((f) => f.key === "section:b")).toMatchObject({ periodStart: null, periodEnd: null, sequenceNo: 2 });
  });
});

describe("SECD-1a markerLabel", () => {
  it("names each shape", () => {
    expect(markerLabel({ periodStart: "2026-10-19", periodEnd: "2026-10-25" }, NOW)).toBe("Week of 19 Oct");
    expect(markerLabel({ periodStart: "2026-11-03", periodEnd: "2026-11-14" }, NOW)).toBe("3 to 14 Nov");
    expect(markerLabel({ periodStart: "2026-10-21", periodEnd: "2026-10-21" }, NOW)).toBe("21 Oct");
    expect(markerLabel({ periodStart: "2026-10-01", periodEnd: "2026-10-31" }, NOW)).toBe("October");
    expect(markerLabel({ sequenceNo: 2 }, NOW)).toBe("#2");
    expect(markerLabel({}, NOW)).toBeNull();
  });

  it("shows the year only when it is not this year, and never a time", () => {
    const labels = [
      markerLabel({ periodStart: "2025-10-21", periodEnd: "2025-10-21" }, NOW),
      markerLabel({ periodStart: "2025-10-01", periodEnd: "2025-10-31" }, NOW),
      markerLabel({ periodStart: "2025-10-20", periodEnd: "2025-10-26" }, NOW),
      markerLabel({ periodStart: "2026-10-21", periodEnd: "2026-10-21" }, NOW),
    ];
    expect(labels).toEqual(["21 Oct 2025", "October 2025", "Week of 20 Oct 2025", "21 Oct"]);
    for (const label of labels) expect(label).not.toMatch(/\d:\d/);
  });
});

describe("SECD-1a periods", () => {
  it("weekOf runs Monday to Sunday, mid-week and on a Sunday", () => {
    expect(weekOf(new Date(2026, 9, 22))).toEqual({ periodStart: "2026-10-19", periodEnd: "2026-10-25" });
    expect(weekOf(new Date(2026, 9, 25))).toEqual({ periodStart: "2026-10-19", periodEnd: "2026-10-25" });
  });

  it("dayOf and monthOf", () => {
    expect(dayOf(new Date(2026, 9, 21))).toEqual({ periodStart: "2026-10-21", periodEnd: "2026-10-21" });
    expect(monthOf(new Date(2026, 1, 10))).toEqual({ periodStart: "2026-02-01", periodEnd: "2026-02-28" });
  });

  it("shift moves a week by seven days both ways and leaves others alone", () => {
    const week = { periodStart: "2026-10-19", periodEnd: "2026-10-25" };
    expect(shift(week, "next")).toEqual({ periodStart: "2026-10-26", periodEnd: "2026-11-01" });
    expect(shift(week, "previous")).toEqual({ periodStart: "2026-10-12", periodEnd: "2026-10-18" });
    const month = { periodStart: "2026-10-01", periodEnd: "2026-10-31" };
    const custom = { periodStart: "2026-11-03", periodEnd: "2026-11-14" };
    expect(shift(month, "next")).toEqual(month);
    expect(shift(custom, "previous")).toEqual(custom);
  });
});

describe("SECD-1a one marker at a time", () => {
  it("a period clears the number and a number clears both dates", () => {
    expect(setPeriodMarker({ periodStart: "2026-10-19", periodEnd: "2026-10-25" })).toEqual({ periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: null });
    expect(setNumberMarker(3)).toEqual({ periodStart: null, periodEnd: null, sequenceNo: 3 });
    expect(clearMarker()).toEqual({ periodStart: null, periodEnd: null, sequenceNo: null });
  });

  it("the server rejects both markers at once, and any marker off a section", () => {
    expect(validateFrameMarker("section:a", { periodStart: "2026-10-19", periodEnd: "2026-10-25", sequenceNo: 1 })).toBe("A section carries a period or a number, not both.");
    expect(validateFrameMarker("custom:x", { sequenceNo: 1 })).toBe("Only a section can carry a period or a number.");
    expect(validateFrameMarker("region:x", { periodStart: "2026-10-19", periodEnd: "2026-10-25" })).toBe("Only a section can carry a period or a number.");
    expect(validateFrameMarker("custom:x", {})).toBeNull();
    expect(validateFrameMarker("section:a", setNumberMarker(0))).toBeNull();
    expect(validateFrameMarker("section:a", setPeriodMarker(weekOf(NOW)))).toBeNull();
  });
});

describe("SECD-1a addedLabel unchanged", () => {
  it("still reads Added 21 Oct, with the year only when it differs", () => {
    expect(addedLabel(new Date(2026, 9, 21, 15, 30).toISOString(), NOW)).toBe("Added 21 Oct");
    expect(addedLabel(new Date(2025, 9, 21, 9).toISOString(), NOW)).toBe("Added 21 Oct 2025");
    expect(addedLabel("not a date", NOW)).toBeNull();
    expect(grownSuffix([new Date(2026, 9, 21, 12).toISOString()], NOW)).toBe(", grown 21 Oct");
  });
});
