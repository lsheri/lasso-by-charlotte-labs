import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { toolArgNames } from "@/lib/mcp-client.server";
import { mapMeetings, nextCursor, resultBand, rowsOf } from "@/lib/wispr.server";

describe("pass169 wispr payload mapping", () => {
  it("finds rows under any of the shapes a server may use", () => {
    expect(rowsOf([{ id: "a" }])).toHaveLength(1);
    expect(rowsOf({ conversations: [{ id: "a" }] })).toHaveLength(1);
    expect(rowsOf({ data: { meetings: [{ id: "a" }, { id: "b" }] } })).toHaveLength(2);
    expect(rowsOf({ anything: [{ id: "a" }] })).toHaveLength(1);
    expect(rowsOf({ a: [{ id: "1" }], b: [{ id: "2" }] })).toHaveLength(0);
    expect(rowsOf(null)).toEqual([]);
  });

  it("accepts identifiers Wispr may name differently", () => {
    const mapped = mapMeetings({
      results: [
        { conversation_id: "c1", name: "One", startTime: "2026-09-01T10:00:00Z" },
        { note_id: "n1", headline: "Two" },
        { weird_id: 42 },
        { title: "no id at all" },
      ],
    });
    expect(mapped.map((m) => m.id)).toEqual(["c1", "n1", "42"]);
    expect(mapped[0]?.title).toBe("One");
    expect(mapped[0]?.date).toBe("2026-09-01T10:00:00Z");
    expect(mapped[2]?.title).toBe("Untitled meeting");
  });

  it("reads a cursor at the top level or inside a pagination object", () => {
    expect(nextCursor({ nextPageToken: "x" })).toBe("x");
    expect(nextCursor({ pagination: { next_cursor: "y" } })).toBe("y");
    expect(nextCursor({ pagination: {} })).toBeNull();
  });
});

describe("pass169 browse bands and arguments", () => {
  it("bands a count into the closed vocabulary", () => {
    expect(resultBand(0)).toBe("0");
    expect(resultBand(1)).toBe("1-10");
    expect(resultBand(10)).toBe("1-10");
    expect(resultBand(11)).toBe("11-30");
    expect(resultBand(30)).toBe("11-30");
    expect(resultBand(31)).toBe("31+");
  });

  it("reads the argument names a tool declares", () => {
    expect(toolArgNames({ name: "t", description: null })).toEqual([]);
    expect(
      toolArgNames({
        name: "t",
        description: null,
        inputSchema: { type: "object", properties: { page_size: {}, page_token: {} } },
      }),
    ).toEqual(["page_size", "page_token"]);
  });
});

describe("pass169 browse reporting stays machine only", () => {
  const fns = readFileSync("src/lib/wispr.functions.ts", "utf8");
  const server = readFileSync("src/lib/wispr.server.ts", "utf8");

  it("emits the new event with closed dimensions on the first page only", () => {
    expect(fns).toContain('eventType: "connector.browse_result"');
    expect(fns).toContain("const firstPage = !data.page_token && pageIndex === 0");
    for (const reason of ["ok", "no_tool", "empty", "error"]) {
      expect(fns).toContain(`"${reason}"`);
    }
    expect(fns).toContain('eventType: "connector.browse_paged"');
  });

  it("keeps meeting content out of the new dimensions and the logs", () => {
    const dims = fns.match(/dims:\s*\{[^}]*\}/g) ?? [];
    expect(dims.length).toBeGreaterThan(0);
    for (const block of dims) {
      for (const word of ["title", "attendee", "transcript", "search", "term"]) {
        expect(block).not.toContain(word);
      }
    }
    const logs = server.match(/console\.\w+\([^;]*\);/g) ?? [];
    expect(logs.length).toBeGreaterThan(0);
    for (const line of logs) {
      for (const word of ["title", "attendee", "transcript", "search"]) {
        expect(line).not.toContain(word);
      }
    }
  });

  it("retries once after a refused token", () => {
    expect(server).toContain('error.kind !== "unauthorized"');
    expect(server).toContain("openSession(profileId, true)");
  });
});
