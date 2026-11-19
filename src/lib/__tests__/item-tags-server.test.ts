// 18 Nov: Firm Brain Build Spec, step 5. "The board lead can correct any tag." The check is on the server: the
// board's lead (its owner) or a workspace admin, on an item in their own workspace that sits on a board. Everyone
// else is refused whatever they send, a private item stays closed, and zero rows back from the write is a refusal.
import { beforeEach, describe, expect, it } from "vitest";

import { methodsOf, roleOf, situationOf, stageOf, TAG_CORRECTION_KEY } from "@/lib/engagement-tags";
import { ITEM_TAGS_COPY, mergeExtractedTags, tagAskFor } from "@/lib/extract-tags-shared";
import { readItemTags, saveItemTags, type TagCaller } from "@/lib/item-tags.server";

import { eqOf, fakeTableDb, type FakeQuery, type FakeResult } from "./helpers/fake-table-db";

type Row = Record<string, unknown>;

const state = {
  items: {} as Record<string, Row>,
  /** work item id -> the board, or boards, it is placed on */
  placed: {} as Record<string, string | string[]>,
  boards: {} as Record<string, Row>,
  refuseWrite: false,
  writeError: false,
};

function answer(query: FakeQuery): FakeResult {
  const id = eqOf(query, "id") as string | undefined;
  if (query.table === "work_items") {
    if (query.op === "update") {
      if (state.writeError) return { data: null, error: { message: "boom" } };
      if (state.refuseWrite || !id || !state.items[id] || state.items[id]!["org_id"] !== eqOf(query, "org_id")) return { data: [], error: null };
      state.items[id] = { ...state.items[id], ...(query.payload as Row) };
      return { data: [{ id }], error: null };
    }
    if (query.one) return { data: id ? (state.items[id] ?? null) : null, error: null };
    const ids = (query.filters.find((filter) => filter.kind === "in")?.value ?? []) as string[];
    return { data: ids.map((itemId) => state.items[itemId]).filter((row) => row && row["org_id"] === eqOf(query, "org_id")), error: null };
  }
  if (query.table === "work_item_tasks") {
    const itemId = eqOf(query, "work_item_id") as string | undefined;
    if (itemId) return { data: [state.placed[itemId] ?? []].flat().map((engagement_id) => ({ tasks: { engagement_id } })), error: null };
    const board = eqOf(query, "tasks.engagement_id") as string;
    return { data: Object.entries(state.placed).filter(([, on]) => [on].flat().includes(board)).map(([work_item_id]) => ({ work_item_id })), error: null };
  }
  if (query.table === "engagements") {
    const ids = (query.filters.find((filter) => filter.kind === "in")?.value ?? []) as string[];
    return { data: ids.map((boardId) => state.boards[boardId]).filter(Boolean), error: null };
  }
  throw new Error(`unexpected table ${query.table}`);
}

let fake = fakeTableDb(answer);
const writes = () => fake.queries.filter((query) => query.op !== "select");

function item(id: string, over: Row = {}) {
  state.items[id] = { id, org_id: "org-1", owner_id: "p-author", type: "call", title: `Item ${id}`, visibility: "mapped", work_date: "2026-03-01", meta: { method: ["survey"], call_role: "founder" }, ...over };
  state.placed[id] = "board-1";
}

const LEAD: TagCaller = { id: "p-lead", org_id: "org-1", role: "em" };
const ADMIN: TagCaller = { id: "p-admin", org_id: "org-1", role: "admin" };
const GOOD = { method: ["expert_calls"], call_role: "chief_medical_officer", stage: null, situation: null };

async function status(run: Promise<unknown>): Promise<number | "ok"> {
  try {
    await run;
    return "ok";
  } catch (thrown) {
    if (thrown instanceof Response) return thrown.status;
    throw thrown;
  }
}

beforeEach(() => {
  state.items = {};
  state.placed = {};
  state.boards = { "board-1": { id: "board-1", org_id: "org-1", owner_id: "p-lead" }, "board-2": { id: "board-2", org_id: "org-2", owner_id: "p-other-lead" } };
  state.refuseWrite = false;
  state.writeError = false;
  fake = fakeTableDb(answer);
  item("call");
});

describe("who may correct an item's tags", () => {
  it("lets the board's lead and a workspace admin read and save", async () => {
    for (const caller of [LEAD, ADMIN]) {
      item("call");
      expect(await readItemTags(fake.db, caller, "call")).toMatchObject({ method: ["survey"], call_role: "founder" });
      const saved = await saveItemTags(fake.db, caller, "call", GOOD);
      expect(saved).toMatchObject({ method: ["expert_calls"], call_role: "chief_medical_officer", corrected: true });
      expect((state.items["call"]!["meta"] as Row)[TAG_CORRECTION_KEY]).toMatchObject({ by: caller.id });
    }
  });

  it("refuses everyone else, on read and on write, and writes nothing", async () => {
    const others: TagCaller[] = [
      { id: "p-em", org_id: "org-1", role: "em" },
      // A workspace lead who does not lead this board, and the item's own author.
      { id: "p-ws-lead", org_id: "org-1", role: "lead" },
      { id: "p-author", org_id: "org-1", role: "em" },
      { id: "p-coach", org_id: "org-1", role: "coach" },
    ];
    for (const caller of others) {
      expect(await status(readItemTags(fake.db, caller, "call")), caller.id).toBe(403);
      expect(await status(saveItemTags(fake.db, caller, "call", GOOD)), caller.id).toBe(403);
      expect(await status(saveItemTags(fake.db, caller, "call", { clear: true })), caller.id).toBe(403);
    }
    expect(writes()).toHaveLength(0);
    expect(state.items["call"]!["meta"]).toEqual({ method: ["survey"], call_role: "founder" });
  });

  it("refuses a person from another workspace, even an admin or that workspace's board lead", async () => {
    for (const caller of [{ id: "p-x", org_id: "org-2", role: "admin" }, { id: "p-other-lead", org_id: "org-2", role: "lead" }]) {
      expect(await status(readItemTags(fake.db, caller, "call"))).toBe(404);
      expect(await status(saveItemTags(fake.db, caller, "call", GOOD))).toBe(404);
    }
    // An item that sits on another workspace's board is refused too.
    state.placed["call"] = "board-2";
    expect(await status(saveItemTags(fake.db, ADMIN, "call", GOOD))).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it("keeps a private item closed to the lead and the admin, and open to its owner only when they lead the board", async () => {
    item("private", { visibility: "private", owner_id: "p-author" });
    for (const caller of [LEAD, ADMIN]) {
      expect(await status(readItemTags(fake.db, caller, "private"))).toBe(404);
      expect(await status(saveItemTags(fake.db, caller, "private", GOOD))).toBe(404);
    }
    item("own-private", { visibility: "private", owner_id: "p-lead" });
    expect(await status(saveItemTags(fake.db, LEAD, "own-private", GOOD))).toBe("ok");
  });

  it("lets a lead correct an item through the board they lead when it also sits on someone else's", async () => {
    state.boards["board-0"] = { id: "board-0", org_id: "org-1", owner_id: "p-someone" };
    state.placed["call"] = ["board-0", "board-1"];
    expect(await status(saveItemTags(fake.db, LEAD, "call", GOOD))).toBe("ok");
    expect(await status(saveItemTags(fake.db, { id: "p-em", org_id: "org-1", role: "em" }, "call", GOOD))).toBe(403);
    state.placed["call"] = ["board-0"];
    expect(await status(saveItemTags(fake.db, LEAD, "call", GOOD))).toBe(403);
  });

  it("refuses an item that is on no board, and an item that does not exist", async () => {
    item("loose");
    delete state.placed["loose"];
    expect(await status(saveItemTags(fake.db, ADMIN, "loose", GOOD))).toBe(400);
    expect(await status(readItemTags(fake.db, ADMIN, "missing"))).toBe(404);
    expect(writes()).toHaveLength(0);
  });
});

describe("what a correction stores", () => {
  it("keeps the model's tags beside the correction, so removing it brings them back", async () => {
    await saveItemTags(fake.db, LEAD, "call", GOOD);
    const meta = state.items["call"]!["meta"] as Row;
    expect(meta["method"]).toEqual(["survey"]);
    expect(meta["call_role"]).toBe("founder");
    expect(methodsOf(meta)).toEqual(["expert_calls"]);
    expect(roleOf(meta)).toBe("chief_medical_officer");

    const cleared = await saveItemTags(fake.db, LEAD, "call", { clear: true });
    expect(cleared).toMatchObject({ method: ["survey"], call_role: "founder", corrected: false });
    expect(state.items["call"]!["meta"]).toEqual({ method: ["survey"], call_role: "founder" });
  });

  it("survives the next extract of the same item", async () => {
    await saveItemTags(fake.db, LEAD, "call", GOOD);
    state.items["call"]!["meta"] = mergeExtractedTags(state.items["call"]!["meta"], { method: ["workshop"], call_role: "buyer" }, tagAskFor({ type: "call" }, false));
    expect(await readItemTags(fake.db, LEAD, "call")).toMatchObject({ method: ["expert_calls"], call_role: "chief_medical_officer", corrected: true });
  });

  it("stores a value outside the lists as other, and refuses a wrong type without writing", async () => {
    const saved = await saveItemTags(fake.db, LEAD, "call", { method: ["survey", "tarot"], call_role: "Harper Quinn" });
    expect(saved).toMatchObject({ method: ["survey", "other"], call_role: "other" });
    expect(JSON.stringify(state.items["call"]!["meta"])).not.toMatch(/tarot|Harper/);

    const before = writes().length;
    for (const bad of [{ method: "survey" }, { method: [1] }, { method: [], call_role: { name: "x" } }, {}]) {
      expect(await status(saveItemTags(fake.db, LEAD, "call", bad))).toBe(400);
    }
    item("deck", { type: "deck", meta: {} });
    expect(await status(saveItemTags(fake.db, LEAD, "deck", { method: [], stage: "final" }))).toBe(400);
    expect(writes()).toHaveLength(before);
  });

  it("stores only the fields the item has: no role on a deck, no stage on a call", async () => {
    item("sow", { type: "document", title: "SOW: Heron", meta: {} });
    item("deck", { type: "deck", meta: {} });
    await saveItemTags(fake.db, LEAD, "deck", { method: ["synthesis"], call_role: "founder", stage: "reviewed", situation: "pricing" });
    const meta = state.items["deck"]!["meta"] as Row;
    expect(Object.keys(meta[TAG_CORRECTION_KEY] as Row).sort()).toEqual(["at", "by", "method", "stage"]);
    expect(stageOf(meta)).toBe("reviewed");
    expect(roleOf(meta)).toBeNull();
    expect(situationOf(meta)).toBeNull();
  });

  it("lets the lead set the situation on the item that carries it, and nowhere else on that board", async () => {
    item("sow", { type: "document", title: "SOW: Heron", meta: { situation: "pricing" } });
    item("deck", { type: "deck", title: "Findings", meta: {} });
    expect((await readItemTags(fake.db, LEAD, "sow")).fields.situation).toBe(true);
    expect((await readItemTags(fake.db, LEAD, "deck")).fields.situation).toBe(false);
    await saveItemTags(fake.db, LEAD, "sow", { method: [], stage: null, situation: "talent" });
    expect(situationOf(state.items["sow"]!["meta"])).toBe("talent");
    await saveItemTags(fake.db, LEAD, "deck", { method: [], stage: null, situation: "integration" });
    expect(situationOf(state.items["deck"]!["meta"])).toBeNull();
  });

  it("lets the lead name the carrier on a board with no SOW or brief, and then only that item holds it", async () => {
    item("deck", { type: "deck", title: "Findings", meta: {} });
    item("memo", { type: "document", title: "Memo", meta: {} });
    await saveItemTags(fake.db, LEAD, "deck", { method: [], stage: null, situation: "integration" });
    expect(situationOf(state.items["deck"]!["meta"])).toBe("integration");
    expect((await readItemTags(fake.db, LEAD, "memo")).fields.situation).toBe(false);
    await saveItemTags(fake.db, LEAD, "memo", { method: [], stage: null, situation: "talent" });
    expect(situationOf(state.items["memo"]!["meta"])).toBeNull();
  });
});

describe("a write that does not land", () => {
  it("treats zero rows back as refused, never as saved", async () => {
    state.refuseWrite = true;
    expect(await status(saveItemTags(fake.db, LEAD, "call", GOOD))).toBe(500);
    expect(state.items["call"]!["meta"]).toEqual({ method: ["survey"], call_role: "founder" });
  });

  it("reports a database error as a failed save", async () => {
    state.writeError = true;
    expect(await status(saveItemTags(fake.db, ADMIN, "call", GOOD))).toBe(500);
  });

  it("names the line the dialog shows when the item is not on a board", async () => {
    item("loose");
    delete state.placed["loose"];
    const thrown = await saveItemTags(fake.db, ADMIN, "loose", GOOD).catch((error: unknown) => error);
    expect(await (thrown as Response).text()).toBe(ITEM_TAGS_COPY.notOnBoard);
  });
});
