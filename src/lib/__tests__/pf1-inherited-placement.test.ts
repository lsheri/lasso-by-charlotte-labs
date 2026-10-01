import { beforeEach, describe, expect, it, vi } from "vitest";

/** PF1: a destination-free call's attachments follow their conversation's one placement. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
const rpcCalls: { name: string; args: Row }[] = [];
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
const table = (name: string): Row[] => (db[name] ??= []);

function builder(name: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" = "select";
  let payload: Row | Row[] | null = null;
  let written: Row[] = [];
  const run = () => {
    if (op === "insert") {
      const rows = (Array.isArray(payload) ? payload : [payload!]).map((r) => ({ id: newId(), ...r }));
      table(name).push(...rows);
      written = rows;
      return rows;
    }
    const hit = table(name).filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      for (const r of hit) Object.assign(r, payload);
      written = hit;
    }
    return hit;
  };
  const b: Record<string, unknown> = {
    select: () => b,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), b),
    update: (p: Row) => ((op = "update"), (payload = p), b),
    eq: (k: string, v: unknown) => (filters.push((r) => !k.includes("->>") && r[k] === v), b),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), b),
    in: (k: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[k])), b),
    order: () => b,
    limit: () => b,
    maybeSingle: async () => ({ data: (op === "select" ? run() : (run(), written))[0] ?? null, error: null }),
    single: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "none" } };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}

const refOfTask = (taskId: unknown) => (taskId === "t1" ? "CFT-01 · General" : "NWG-02 · Research");

/** Stands in for mcp_place_item: never moves when p_move is false. */
async function placeItem(args: Row) {
  const maps = table("work_item_tasks");
  const mine = maps.filter((m) => m["work_item_id"] === args["p_work_item"]);
  if (mine.some((m) => m["task_id"] === args["p_task"])) return { status: "already_here", ref: refOfTask(args["p_task"]) };
  if (mine.length > 0 && !args["p_move"]) {
    return { status: "on_other", placements: mine.map((m) => ({ ref: refOfTask(m["task_id"]) })) };
  }
  maps.push({ work_item_id: args["p_work_item"], task_id: args["p_task"] });
  return { status: "placed", ref: refOfTask(args["p_task"]) };
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => builder(name),
    rpc: async (name: string, args: Row) => {
      rpcCalls.push({ name, args });
      return { data: await placeItem(args), error: null };
    },
    storage: { from: () => ({ upload: async () => ({ error: null }), download: async () => ({ data: null }) }) },
  },
}));
vi.mock("@/lib/telemetry.server", () => ({
  recordEvent: async (_c: unknown, e: { eventType: string; dims: Record<string, unknown> }) => {
    events.push(e);
  },
}));
vi.mock("@/lib/extract.server", () => ({ ensureExtracts: async () => {} }));
vi.mock("../extract.server", () => ({ ensureExtracts: async () => {} }));
vi.mock("../chain-links.server", () => ({ recordSameConversationChain: async () => {} }));
vi.mock("../telemetry-v2.server", () => ({ recordEventV2: async () => {} }));
vi.mock("../capture-census.server", () => ({ noteCaptureContext: async () => {} }));
vi.mock("@/lib/work-taxonomy.server", () => ({ noteModelUsed: async () => {}, noteThreadShape: async () => {} }));
vi.mock("@/lib/connector-import.server", () => ({ recordNewVersion: async () => 2 }));
vi.mock("@/lib/org-type.server", () => ({ isAffiliatedStrict: async () => false, orgTypeOfStrict: async () => "company" }));

import { pushConversation, type AttachmentOutcome } from "@/lib/mcp-handler.server";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1", kind: "link", readOnly: false, legacy: true, authKind: "link" as const };
type Out = { result: { content: { text: string }[]; structuredContent: Record<string, unknown> } };
const push = async (args: Row) => (await (await pushConversation(OWNER, args, 1)).json()) as Out;

const ART = (n: string) => Array.from({ length: 30 }, (_, i) => `Line ${i + 1} of ${n}, the chat's own artifact.`).join("\n");
const MSGS = [
  { role: "user", content: "Please draft the plan." },
  { role: "assistant", content: "Here is the plan as an artifact." },
];
const ATTS = [
  { kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART("Plan") },
  { kind: "artifact_markdown", title: "Memo", source_artifact_id: "a2", content: ART("Memo") },
];
const thread = () => table("work_items").find((r) => r["type"] === "ai_thread")!;
const idOf = (title: string) => table("work_items").find((r) => r["title"] === title)!["id"];
const mapsOf = (id: unknown) => table("work_item_tasks").filter((m) => m["work_item_id"] === id).map((m) => m["task_id"]);
const receipts = (out: Out) => out.result.structuredContent["attachments"] as AttachmentOutcome[];
const pushDims = () => events.filter((e) => e.eventType === "mcp.push").at(-1)!.dims;

/** Call 1 of a window: the conversation alone, optionally placed. */
async function firstCall(placeOn: string[]) {
  await push({ vendor: "claude", orig_conversation_id: "c1", messages: MSGS.slice(0, 1), window: { from: 1, total: 2 } });
  for (const task of placeOn) table("work_item_tasks").push({ work_item_id: thread()["id"], task_id: task });
  events.length = 0;
  rpcCalls.length = 0;
}
const secondCall = (extra: Row = {}) =>
  push({ vendor: "claude", orig_conversation_id: "c1", messages: MSGS.slice(1), window: { from: 2, total: 2 }, attachments: ATTS, ...extra });

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  rpcCalls.length = 0;
  seq = 0;
  table("engagement_members").push({ engagement_id: "e1", profile_id: "p1", member_role: "owner" }, { engagement_id: "e2", profile_id: "p1", member_role: "owner" });
  table("engagements").push(
    { id: "e1", code: "CFT-01", title: "Cure First", client_label: null, clients: null },
    { id: "e2", code: "NWG-02", title: "Northwind", client_label: null, clients: null },
  );
  table("tasks").push({ id: "t1", engagement_id: "e1", name: "General" }, { id: "t2", engagement_id: "e2", name: "Research" });
});

describe("PF1 inherited placement", () => {
  it("places attachments on the conversation's one board, outcome inherited", async () => {
    await firstCall(["t1"]);
    const out = await secondCall();
    expect(mapsOf(idOf("Plan"))).toEqual(["t1"]);
    expect(mapsOf(idOf("Memo"))).toEqual(["t1"]);
    expect(receipts(out).map((r) => [r.outcome, r.placement])).toEqual([["new", "inherited"], ["new", "inherited"]]);
    expect(rpcCalls.every((c) => c.args["p_move"] === false && c.args["p_work_item"] !== thread()["id"])).toBe(true);
    expect(out.result.structuredContent["attachments_placed"]).toBe(2);
    expect(pushDims()["attachments_placed"]).toBe("2+");
    expect(mapsOf(thread()["id"])).toEqual(["t1"]);
  });

  it("keeps storage and placement separate: unchanged in storage, inherited in placement", async () => {
    await firstCall([]);
    await secondCall();
    table("work_item_tasks").push({ work_item_id: thread()["id"], task_id: "t1" });
    const out = await secondCall();
    expect(receipts(out).map((r) => [r.outcome, r.placement])).toEqual([["unchanged", "inherited"], ["unchanged", "inherited"]]);
  });

  it("zero placements: inbox, inbox_no_destination, and a notes line", async () => {
    await firstCall([]);
    const out = await secondCall();
    expect(mapsOf(idOf("Plan"))).toEqual([]);
    expect(table("work_items").find((r) => r["title"] === "Plan")!["visibility"]).toBe("unmapped");
    expect(receipts(out).map((r) => r.placement)).toEqual(["inbox_no_destination", "inbox_no_destination"]);
    const notes = out.result.structuredContent["notes"] as string[];
    expect(notes.join(" ")).toContain("2 attachments stayed in the inbox: this call named no destination");
    expect(notes.join(" ")).not.toContain("\u2014");
    expect(rpcCalls).toHaveLength(0);
    expect(out.result.structuredContent["attachments_placed"]).toBe(0);
    expect(pushDims()["attachments_placed"]).toBe("0");
  });

  it("two placements: inbox_ambiguous, nothing guessed", async () => {
    await firstCall(["t1", "t2"]);
    const out = await secondCall();
    expect(mapsOf(idOf("Plan"))).toEqual([]);
    expect(rpcCalls).toHaveLength(0);
    expect(receipts(out).map((r) => r.placement)).toEqual(["inbox_ambiguous", "inbox_ambiguous"]);
    expect((out.result.structuredContent["notes"] as string[]).join(" ")).toContain("in more than one place, so Lasso did not choose");
    expect(pushDims()["attachments_placed"]).toBe("0");
    expect(mapsOf(thread()["id"])).toEqual(["t1", "t2"]);
  });

  it("an attachment already on another board is not moved, outcome on_other", async () => {
    await firstCall([]);
    await secondCall();
    table("work_item_tasks").push({ work_item_id: idOf("Plan"), task_id: "t2" }, { work_item_id: thread()["id"], task_id: "t1" });
    const out = await secondCall();
    expect(mapsOf(idOf("Plan"))).toEqual(["t2"]);
    expect(receipts(out).find((r) => r.title === "Plan")!.placement).toBe("on_other");
    expect(receipts(out).find((r) => r.title === "Memo")!.placement).toBe("inherited");
    expect((out.result.structuredContent["notes"] as string[]).join(" ")).toContain("1 attachment is already on another board and was left there.");
    expect(mapsOf(thread()["id"])).toEqual(["t1"]);
  });
});

describe("PF1 destination present: unchanged behaviour", () => {
  it("places the conversation and attachments exactly as before", async () => {
    const out = await push({ vendor: "claude", orig_conversation_id: "c2", messages: MSGS, attachments: ATTS, destination: "CFT-01 · General" });
    const sc = out.result.structuredContent;
    expect(rpcCalls.map((c) => [c.args["p_work_item"], c.args["p_task"], c.args["p_move"]])).toEqual([
      [thread()["id"], "t1", false],
      [idOf("Plan"), "t1", false],
      [idOf("Memo"), "t1", false],
    ]);
    expect(sc["placement"]).toEqual({
      target: "workboard",
      ref: "CFT-01 · General",
      status: "placed",
      note: "Saved and placed on CFT-01 · General. Your engagement team can see it there.",
    });
    expect(sc["attachments_placed"]).toBe(2);
    expect(sc["attachments_total"]).toBe(2);
    expect(sc["summary"]).toBe(
      "Saved 'Please draft the plan.' in Lasso. 2 messages captured. Attachments: 2 new. 2 attachments placed on CFT-01 · General. Stored 1 user 22 'Please draft the plan.' · 2 assistant 32 'Here is the plan as an artifact.'. Saved and placed on CFT-01 · General. Your engagement team can see it there. No link back to this chat was recorded. If you can see this conversation's URL, call again with chat_url so the saved work can point back to it.",
    );
    expect(sc["notes"]).toEqual([
      "No link back to this chat was recorded. If you can see this conversation's URL, call again with chat_url so the saved work can point back to it.",
    ]);
    // The only addition is the separate placement field on the existing receipts.
    expect(receipts(out)).toEqual([
      { title: "Plan", source_artifact_id: "a1", outcome: "new", chars: ART("Plan").length, placement: "placed" },
      { title: "Memo", source_artifact_id: "a2", outcome: "new", chars: ART("Memo").length, placement: "placed" },
    ]);
    expect(pushDims()["attachments_placed"]).toBe("2+");
    expect(pushDims()["target"]).toBe("workboard");
  });

  it("with a destination, an attachment on another board is left there", async () => {
    await push({ vendor: "claude", orig_conversation_id: "c3", messages: MSGS, attachments: ATTS });
    table("work_item_tasks").push({ work_item_id: idOf("Plan"), task_id: "t2" });
    const out = await push({ vendor: "claude", orig_conversation_id: "c3", messages: MSGS, attachments: ATTS, destination: "CFT-01 · General" });
    expect(mapsOf(idOf("Plan"))).toEqual(["t2"]);
    expect(receipts(out).find((r) => r.title === "Plan")!.placement).toBe("on_other");
    expect(out.result.structuredContent["summary"]).toContain("1 of 2 attachments placed on CFT-01 · General; the rest stayed in the inbox.");
  });
});
