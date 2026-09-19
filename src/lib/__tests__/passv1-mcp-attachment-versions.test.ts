import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { decideAttachmentWrite, versionRowsBucket } from "@/lib/mcp-handler.server";
import { recordNewVersion } from "@/lib/connector-import.server";

describe("pass V1 decideAttachmentWrite", () => {
  it("inserts when nothing matched", () => {
    expect(decideAttachmentWrite(null, "abc")).toBe("insert");
  });

  it("leaves an identical artifact alone", () => {
    expect(decideAttachmentWrite({ content_hash: "abc" }, "abc")).toBe("unchanged");
  });

  it("records a version when the bytes differ", () => {
    expect(decideAttachmentWrite({ content_hash: "abc" }, "def")).toBe("new_version");
    expect(decideAttachmentWrite({ content_hash: null }, "def")).toBe("new_version");
  });

  it("bands the version count without content", () => {
    expect(versionRowsBucket(0)).toBe("0");
    expect(versionRowsBucket(1)).toBe("1");
    expect(versionRowsBucket(3)).toBe("2+");
  });
});

describe("pass V1 attachment branch", () => {
  const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
  const branch = source.slice(source.indexOf("decideAttachmentWrite(match"));

  it("never overwrites a stored object", () => {
    expect(branch).not.toContain("upsert: true");
  });

  it("keeps the earlier version", () => {
    expect(branch).toContain("recordNewVersion(supabaseAdmin");
    expect(branch).toContain('sourceEvent: "mcp_repush"');
  });

  it("gives inserts a unique path too, so a retry cannot collide", () => {
    expect(branch).not.toContain('decision === "insert" ? base');
    expect(branch).toContain('const path = `${base}-${crypto.randomUUID()}`;');
  });

  it("counts one row when the item already has a version", () => {
    expect(branch).toContain('from("document_versions")');
    expect(branch).toContain("attachmentVersionRows += existingVersion ? 1 : 2;");
    expect(branch).not.toContain("nextNo === 2 ? 2 : 1");
  });
});

type Row = Record<string, unknown>;

function fakeClient(rows: Row[], existing: { id: string; version_no: number }[]) {
  return {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                order: () => Promise.resolve({ data: existing, error: null }),
              };
            },
          };
        },
        insert(row: Row) {
          rows.push(row);
          return {
            select: () => ({
              maybeSingle: () => Promise.resolve({ data: { id: "v1", version_no: 1 }, error: null }),
            }),
            then: (resolve: (v: { error: null }) => void) => resolve({ error: null }),
          };
        },
      };
    },
  } as never;
}

describe("pass V1 recordNewVersion", () => {
  it("writes the same fields when origin is omitted", async () => {
    const rows: Row[] = [];
    const next = await recordNewVersion(fakeClient(rows, [{ id: "p1", version_no: 2 }]), {
      workItemId: "w1",
      previousRef: "old/path",
      previousHash: "old",
      previousAt: "2026-01-01T00:00:00Z",
      newRef: "new/path",
      newHash: "new",
      sourceEvent: "drive_recheck",
    });
    expect(next).toBe(3);
    expect(rows).toEqual([
      {
        work_item_id: "w1",
        version_no: 3,
        content_ref: "new/path",
        content_hash: "new",
        parent_version_id: "p1",
        source_event: "drive_recheck",
      },
    ]);
  });

  it("carries origin through when given", async () => {
    const rows: Row[] = [];
    await recordNewVersion(fakeClient(rows, [{ id: "p1", version_no: 1 }]), {
      workItemId: "w1",
      previousRef: "old/path",
      previousHash: "old",
      previousAt: "2026-01-01T00:00:00Z",
      newRef: "new/path",
      newHash: "new",
      sourceEvent: "mcp_repush",
      origin: "model_artifact",
    });
    expect(rows[0]!["origin"]).toBe("model_artifact");
  });
});
