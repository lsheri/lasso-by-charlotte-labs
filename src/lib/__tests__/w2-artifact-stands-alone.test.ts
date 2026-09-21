import { describe, expect, it } from "vitest";

import {
  canGoBackToChat,
  canStandAlone,
  cameOutOfLine,
  isTranscriptPiece,
  TRANSCRIPT_REFUSAL,
} from "../work-standalone";
import { setWorkItemStandalone } from "../work-standalone.server";
import {
  entryItems,
  groupConversations,
  groupedCount,
  isConversationGroup,
  type ConversationGroup,
  type WorkItemRow,
} from "../work-types";

/* ------------------------------------------------------------------ */
/* the grouping                                                        */
/* ------------------------------------------------------------------ */

function row(over: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: "i1",
    owner_id: "me",
    client_id: null,
    title: "A piece",
    type: "document",
    source: "mcp:claude",
    visibility: "unmapped",
    captured_at: new Date().toISOString(),
    content_ref: null,
    source_vendor: "claude",
    orig_conversation_id: "c1",
    ungrouped_at: null,
    source_meta: { role: "attachment", kind: "artifact_markdown" },
    meta: null,
    work_item_tasks: [],
    ...over,
  } as WorkItemRow;
}

const transcript = row({
  id: "t",
  type: "ai_thread",
  title: "Diligence chat",
  source_meta: { role: "transcript" },
});

/** One transcript and nine artifacts, from one push. */
const push: WorkItemRow[] = [
  transcript,
  ...Array.from({ length: 9 }, (_, n) => row({ id: `a${n}` })),
];

describe("W2 — a lifted artifact stops being grouped", () => {
  it("groups everything while no piece is lifted", () => {
    const entries = groupConversations(push);
    expect(entries).toHaveLength(1);
    expect(entryItems(entries[0]!)).toHaveLength(10);
  });

  it("reads as eight artifacts once one is lifted, not nine", () => {
    const lifted = push.map((item) =>
      item.id === "a0" ? { ...item, ungrouped_at: new Date().toISOString() } : item,
    );
    const entries = groupConversations(lifted);
    const group = entries.find(isConversationGroup) as ConversationGroup;
    expect(group.attachments).toHaveLength(8);
    expect(group.items).toHaveLength(9);
    // The lifted piece is now an ordinary row of its own, so the page shows two.
    expect(groupedCount(lifted)).toBe(2);
    expect(entries.filter((entry) => !isConversationGroup(entry))).toHaveLength(1);
  });

  it("puts it straight back when the stamp is cleared", () => {
    const back = push.map((item) => ({ ...item, ungrouped_at: null }));
    const entries = groupConversations(back);
    expect(entries).toHaveLength(1);
    expect(entryItems(entries[0]!)).toHaveLength(10);
  });

  it("leaves a conversation of one behind as an ordinary row, never a group of one", () => {
    const pair = [transcript, row({ id: "only", ungrouped_at: new Date().toISOString() })];
    const entries = groupConversations(pair);
    expect(entries).toHaveLength(2);
    expect(entries.every((entry) => !isConversationGroup(entry))).toBe(true);
  });
});

describe("W2 — only an attachment can be lifted", () => {
  it("refuses the transcript, because it is the conversation itself", () => {
    expect(isTranscriptPiece(transcript)).toBe(true);
    expect(canStandAlone(transcript)).toBe(false);
    // A transcript with no role stamped is still a conversation by its type.
    expect(canStandAlone(row({ type: "ai_thread", source_meta: null }))).toBe(false);
  });

  it("offers it on an artifact, and offers the way back once it is lifted", () => {
    expect(canStandAlone(row())).toBe(true);
    expect(canGoBackToChat(row())).toBe(false);
    const lifted = row({ ungrouped_at: new Date().toISOString() });
    expect(canStandAlone(lifted)).toBe(false);
    expect(canGoBackToChat(lifted)).toBe(true);
  });

  it("offers neither on a piece that never came out of a chat", () => {
    const alone = row({ orig_conversation_id: null });
    expect(canStandAlone(alone)).toBe(false);
    expect(canGoBackToChat(alone)).toBe(false);
  });
});

describe("W2 — it says where it came from", () => {
  it("names the kind and the vendor in plain words", () => {
    expect(cameOutOfLine(row())).toBe("Markdown that came out of a Claude chat");
    expect(cameOutOfLine(row({ source_vendor: "chatgpt", source_meta: { role: "attachment", kind: "canvas_document" } }))).toBe(
      "Doc that came out of a ChatGPT chat",
    );
  });

  it("says AI instead of the vendor where the vendor is withheld", () => {
    expect(cameOutOfLine(row(), { vendorVisible: false })).toBe(
      "Markdown that came out of a AI chat",
    );
  });

  it("says nothing on a transcript, which is the chat rather than something out of one", () => {
    expect(cameOutOfLine(transcript)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* the write, on a stubbed caller-scoped client                        */
/* ------------------------------------------------------------------ */

type Store = Record<string, Record<string, unknown>[]>;

/** A very small stand-in for the caller-scoped client, tables in memory. */
function makeDb(store: Store) {
  const writes: { table: string; op: string; row: Record<string, unknown> }[] = [];

  function chain(table: string) {
    const filters: ((row: Record<string, unknown>) => boolean)[] = [];
    let mode: "select" | "update" | "insert" = "select";
    let patch: Record<string, unknown> = {};
    let inserted: Record<string, unknown> | null = null;
    let cap: number | null = null;

    const rows = () => (store[table] ?? []).filter((r) => filters.every((f) => f(r)));

    const settle = () => {
      if (mode === "insert") {
        const row = { id: `${table}-${(store[table] ?? []).length + 1}`, version: 1, ...inserted };
        store[table] = [...(store[table] ?? []), row];
        writes.push({ table, op: "insert", row });
        return { data: row, error: null };
      }
      if (mode === "update") {
        const touched = rows();
        for (const row of touched) Object.assign(row, patch);
        writes.push({ table, op: "update", row: patch });
        return { data: touched, error: null };
      }
      const list = cap === null ? rows() : rows().slice(0, cap);
      return { data: list, error: null };
    };

    const api: Record<string, unknown> = {
      select: () => api,
      insert: (value: Record<string, unknown>) => {
        mode = "insert";
        inserted = value;
        return api;
      },
      update: (value: Record<string, unknown>) => {
        mode = "update";
        patch = value;
        return api;
      },
      eq: (column: string, value: unknown) => {
        filters.push((r) => r[column] === value);
        return api;
      },
      in: (column: string, values: unknown[]) => {
        filters.push((r) => values.includes(r[column]));
        return api;
      },
      is: (column: string, value: unknown) => {
        filters.push((r) => (r[column] ?? null) === value);
        return api;
      },
      limit: (n: number) => {
        cap = n;
        return api;
      },
      maybeSingle: async () => ({ data: (settle().data as Record<string, unknown>[])[0] ?? null, error: null }),
      single: async () => {
        const out = settle();
        const data = Array.isArray(out.data) ? out.data[0] ?? null : out.data;
        return { data, error: null };
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(settle()).then(resolve),
    };
    return api;
  }

  return { db: { from: (table: string) => chain(table) } as never, writes, store };
}

const profile = { id: "me", org_id: "org", role: "member" as const };

function baseStore(): Store {
  return {
    work_items: [
      { id: "t", type: "ai_thread", owner_id: "me", orig_conversation_id: "c1", source_meta: { role: "transcript" }, ungrouped_at: null },
      { id: "a0", type: "document", owner_id: "me", orig_conversation_id: "c1", source_meta: { role: "attachment" }, ungrouped_at: null },
    ],
    workboards: [],
    workboard_nodes: [],
    workboard_links: [],
    engagement_members: [],
  };
}

describe("W2 — the write", () => {
  it("stamps the artifact, and clears the stamp again", async () => {
    const { db, store } = makeDb(baseStore());
    const on = await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    expect(on).toMatchObject({ status: "saved", standsAlone: true });
    expect(store["work_items"]![1]!["ungrouped_at"]).toBeTruthy();

    const off = await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: false });
    expect(off).toMatchObject({ status: "saved", standsAlone: false });
    expect(store["work_items"]![1]!["ungrouped_at"]).toBeNull();
  });

  it("refuses the transcript in plain words, and writes nothing", async () => {
    const { db, store, writes } = makeDb(baseStore());
    const result = await setWorkItemStandalone(db, profile, { workItemId: "t", standAlone: true });
    expect(result).toEqual({ status: "refused", message: TRANSCRIPT_REFUSAL });
    expect(store["work_items"]![0]!["ungrouped_at"]).toBeNull();
    expect(writes).toHaveLength(0);
  });

  it("is refused for anyone who does not own the row", async () => {
    const { db, writes } = makeDb(baseStore());
    const result = await setWorkItemStandalone(
      db,
      { ...profile, id: "someone-else" },
      { workItemId: "a0", standAlone: true },
    );
    expect(result).toEqual({ status: "forbidden" });
    expect(writes).toHaveLength(0);
  });

  it("leaves every board alone when the conversation is not on one", async () => {
    const { db, store, writes } = makeDb(baseStore());
    const result = await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    expect(result).toMatchObject({ status: "saved", linkedOnBoard: false });
    expect(store["workboard_nodes"]).toHaveLength(0);
    expect(store["workboard_links"]).toHaveLength(0);
    expect(writes.every((write) => write.table === "work_items")).toBe(true);
  });

  it("joins the two cards where the conversation already has one", async () => {
    const store = baseStore();
    store["workboards"] = [{ id: "b1", engagement_id: "e1" }];
    store["workboard_nodes"] = [
      { id: "n-chat", workboard_id: "b1", work_item_id: "t", deleted_at: null },
    ];
    store["engagement_members"] = [
      { engagement_id: "e1", profile_id: "me", member_role: "lead" },
    ];
    const { db } = makeDb(store);

    const result = await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    expect(result).toMatchObject({ status: "saved", linkedOnBoard: true });
    // The artifact got a card of its own, and the conversation kept the one it had.
    expect(store["workboard_nodes"]).toHaveLength(2);
    const link = store["workboard_links"]![0]!;
    expect(link["from_node_id"]).toBe("n-chat");
    expect(link["relation"]).toBe("produced");
  });

  it("draws nothing on a board the person may only read", async () => {
    const store = baseStore();
    store["workboards"] = [{ id: "b1", engagement_id: "e1" }];
    store["workboard_nodes"] = [
      { id: "n-chat", workboard_id: "b1", work_item_id: "t", deleted_at: null },
    ];
    store["engagement_members"] = [{ engagement_id: "e1", profile_id: "me", member_role: "coach" }];
    const { db } = makeDb(store);

    const result = await setWorkItemStandalone(db, profile, { workItemId: "a0", standAlone: true });
    expect(result).toMatchObject({ status: "saved", linkedOnBoard: false });
    expect(store["workboard_links"]).toHaveLength(0);
  });
});
