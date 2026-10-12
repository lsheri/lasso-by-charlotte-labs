import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: async () => undefined }));
vi.mock("../telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: async () => undefined }));

import { readBoard } from "@/lib/board-share-open.server";

const SECRET = "SECRET TURN TEXT the owner typed";

function fakeDb() {
  const tables: string[] = [];
  const data: Record<string, unknown> = {
    workboards: { id: "wb-1", engagement_id: "e-1", version: 1 },
    engagements: { id: "e-1", org_id: "org-1", brief: "Brief" },
    workboard_frames: [],
    workboard_nodes: [],
    workboard_links: [],
    decisions: [],
    tasks: [
      {
        id: "t-1",
        name: "Task",
        detail: null,
        position: 0,
        work_item_tasks: [
          {
            work_items: {
              id: "wi-1",
              title: "A conversation",
              type: "ai_thread",
              visibility: "mapped",
              owner_id: "p-owner",
              source: "claude",
              captured_at: "2026-10-01T00:00:00Z",
            },
          },
        ],
      },
    ],
    turns: [{ id: "tu-1", work_item_id: "wi-1", turn_no: 1, role: "user", content: SECRET, ts: null, model: "m" }],
    work_item_extracts: [{ work_item_id: "wi-1", summary: "A short summary" }],
    document_versions: [],
  };
  const db = {
    from(table: string) {
      tables.push(table);
      const rows = data[table] ?? [];
      const builder: Record<string, unknown> & { maybeSingle?: unknown; then?: unknown } = {};
      for (const m of ["select", "eq", "is", "in", "order", "limit", "not"]) builder[m] = () => builder;
      builder.maybeSingle = async () => ({ data: Array.isArray(rows) ? rows[0] ?? null : rows, error: null });
      builder.then = (resolve: (v: unknown) => unknown) => resolve({ data: rows, error: null });
      return builder;
    },
    storage: { from: () => ({ download: async () => ({ data: null, error: { message: "none" } }) }) },
  };
  return { db, tables };
}

describe("SH-3c-1 public link carries no turn text", () => {
  it("never reads turns and returns no turn content", async () => {
    const { db, tables } = fakeDb();
    const dto = await readBoard(db as never, "wb-1", { org_id: "org-1", expires_at: "2099-01-01T00:00:00Z" }, "p-owner");
    expect(dto).not.toBeNull();
    expect(tables).not.toContain("turns");
    expect(JSON.stringify(dto)).not.toContain(SECRET);
    expect(dto?.cardPreviews?.["wi-1"]?.summary).toBe("A short summary");
    expect(dto?.turns).toEqual({});
  });
});
