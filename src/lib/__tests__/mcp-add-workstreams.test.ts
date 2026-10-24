/**
 * MCP-WS-1: lasso_add_workstreams. The connector path writes the tasks row
 * and then the board outline, records one workboard.workstream_created per
 * created workstream, and refuses a coach the same way it refuses a
 * non-member: the board simply is not found.
 */
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = Record<string, unknown>;
type TableConfig = {
  rows?: Row[];
  row?: Row | null;
  error?: { message: string } | null;
  insertRow?: Row | null;
  insertError?: { message: string } | null;
};

const mocks = vi.hoisted(() => ({
  tables: {} as Record<string, TableConfig>,
  inserts: [] as { table: string; row: Row }[],
  rpcResults: {} as Record<string, unknown>,
  recordEvent: vi.fn(),
  applyWorkboardCommand: vi.fn(),
  ensureBoard: vi.fn(),
}));

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    rpc: (name: string) => Promise.resolve({ data: mocks.rpcResults[name] ?? null, error: null }),
    from(table: string) {
      const cfg = () => mocks.tables[table] ?? {};
      const query: Record<string, unknown> = {
        eq: () => query,
        in: () => query,
        is: () => query,
        maybeSingle: () => Promise.resolve({ data: cfg().row ?? null, error: cfg().error ?? null }),
        single: () => Promise.resolve({ data: cfg().row ?? null, error: cfg().error ?? null }),
        then: (resolve: (value: unknown) => unknown) =>
          resolve({ data: cfg().rows ?? [], error: cfg().error ?? null }),
      };
      return {
        select: () => query,
        insert: (row: Row) => {
          mocks.inserts.push({ table, row });
          return {
            select: () => ({
              single: () =>
                Promise.resolve({ data: cfg().insertRow ?? null, error: cfg().insertError ?? null }),
            }),
          };
        },
      };
    },
  },
}));

vi.mock("@/lib/canvas-lab.server", () => ({
  applyWorkboardCommand: mocks.applyWorkboardCommand,
  ensureBoard: mocks.ensureBoard,
}));

vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: mocks.recordEvent,
  recordAnonymousEvent: vi.fn(),
}));

const { addWorkstreams, createBoard } = await import("@/lib/mcp-handler.server");
type Owner = import("@/lib/mcp-handler.server").Owner;
const { createWorkstreamWithFrame, drawWorkstreamFrame } = await import("@/lib/workstream-create.server");
const { mcpVocabFor } = await import("@/lib/mcp-vocab");

const owner: Owner = {
  tokenId: "tok",
  profileId: "p1",
  orgId: "o1",
  userId: "u1",
  kind: "pat",
  readOnly: false,
  legacy: false,
  authKind: "link",
};

const memberBoard: Record<string, TableConfig> = {
  engagement_members: { rows: [{ engagement_id: "eng1", member_role: "member" }] },
  engagements: { rows: [{ id: "eng1", code: "CFT-01", title: "Diagnostic" }] },
  profiles: { row: { id: "p1", org_id: "o1", role: "member" } },
  tasks: { rows: [], insertRow: { id: "t1" } },
  workboard_frames: { rows: [] },
  workboard_nodes: { rows: [] },
};

async function resultText(res: Response): Promise<string> {
  const body = (await res.json()) as { result?: { content?: { text: string }[] } };
  return body.result?.content?.[0]?.text ?? "";
}

beforeEach(() => {
  mocks.tables = structuredClone(memberBoard);
  mocks.inserts = [];
  mocks.recordEvent.mockReset();
  mocks.applyWorkboardCommand.mockReset();
  mocks.applyWorkboardCommand.mockResolvedValue({
    status: "saved",
    boardId: "b1",
    boardVersion: 2,
    created: { frameId: "f1" },
    versions: {},
  });
  mocks.ensureBoard.mockReset();
  mocks.ensureBoard.mockResolvedValue({ id: "b1", engagement_id: "eng1", version: 1 });
});

describe("MCP-WS-1 lasso_add_workstreams", () => {
  it("writes the task, then the frame, and records one event", async () => {
    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);

    const taskInsert = mocks.inserts.find((one) => one.table === "tasks");
    expect(taskInsert?.row).toMatchObject({
      engagement_id: "eng1",
      owner_id: "p1",
      name: "Pricing",
      status: "open",
      position: 1,
    });
    expect(mocks.applyWorkboardCommand).toHaveBeenCalledTimes(1);
    const command = mocks.applyWorkboardCommand.mock.calls[0]?.[3] as {
      type: string;
      frame: Record<string, unknown>;
    };
    expect(command.type).toBe("frame_create");
    expect(command.frame).toMatchObject({ key: "task:t1", kind: "task", taskId: "t1", label: "Pricing", ord: 0 });
    expect(mocks.recordEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordEvent).toHaveBeenCalledWith(expect.anything(), {
      eventType: "workboard.workstream_created",
      orgId: "o1",
      userId: "u1",
      profileId: "p1",
      dims: { via: "mcp", claimed: "0" },
    });
    expect(text).toContain("Pricing: created");
  });

  it("writes nothing and records nothing when the name already exists", async () => {
    mocks.tables["tasks"] = {
      rows: [{ id: "t9", name: "pricing", is_board_default: false, position: 1 }],
    };
    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);

    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.applyWorkboardCommand).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
    expect(text).toContain("Pricing: already exists");
  });

  it("skips the board's default task when matching an existing name", async () => {
    mocks.tables["tasks"] = {
      rows: [{ id: "t0", name: "Pricing", is_board_default: true, position: 0 }],
      insertRow: { id: "t2" },
    };
    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);

    expect(mocks.inserts.find((one) => one.table === "tasks")).toBeTruthy();
    expect(text).toContain("Pricing: created");
  });

  it("records no event and reports failed when the tasks insert errors", async () => {
    mocks.tables["tasks"] = { rows: [], insertError: { message: "boom" } };
    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);

    expect(mocks.recordEvent).not.toHaveBeenCalled();
    expect(mocks.applyWorkboardCommand).not.toHaveBeenCalled();
    expect(text).toContain("Pricing: failed");
  });

  it("reports a frame failure with the task id kept on the result", async () => {
    mocks.applyWorkboardCommand.mockResolvedValue({ status: "error", message: "nope" });
    const result = await createWorkstreamWithFrame({ engagementId: "eng1", profileId: "p1", name: "Pricing" });

    expect(result).toEqual({ status: "failed", reason: "frame", taskId: "t1" });
    expect(mocks.recordEvent).not.toHaveBeenCalled();

    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);
    expect(text).toContain("Pricing: the workstream was made but could not be drawn on the board");
  });

  it("refuses a coach the same way as a board that does not exist", async () => {
    mocks.tables["engagement_members"] = { rows: [{ engagement_id: "eng1", member_role: "coach" }] };
    const res = await addWorkstreams(owner, { board: "CFT-01", names: ["Pricing"] }, 1);
    const text = await resultText(res);

    expect(text).toContain("I could not find a board called CFT-01");
    expect(mocks.inserts).toHaveLength(0);
    expect(mocks.applyWorkboardCommand).not.toHaveBeenCalled();
    expect(mocks.recordEvent).not.toHaveBeenCalled();
  });
});

describe("MCP-WS-1 the registered tool", () => {
  const source = readFileSync("src/lib/mcp-handler.server.ts", "utf8");
  const toolBlock = source.slice(
    source.indexOf("const ADD_WORKSTREAMS_TOOL"),
    source.indexOf("const pushTools"),
  );

  it("is listed and dispatched under its fixed name", () => {
    expect(source).toContain("ADD_WORKSTREAMS_TOOL,");
    expect(source).toContain('if (name === "lasso_add_workstreams") return await addWorkstreams(owner, args, id);');
    expect(toolBlock).toContain('name: "lasso_add_workstreams"');
  });

  it("describes boards and workstreams only", () => {
    const forbidden = ["transcript", "verbatim", "summary", "summarise", "summarize", "reasoning", "thinking"];
    for (const word of forbidden) {
      expect(toolBlock.toLowerCase()).not.toContain(word);
    }
  });
});
