import { beforeEach, describe, expect, it, vi } from "vitest";

/** ID-2: every attachment matches back to its chat; every push returns the chat's id. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const events: { eventType: string; dims: Record<string, unknown> }[] = [];
let seq = 0;
const newId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;

function table(name: string): Row[] {
  return (db[name] ??= []);
}

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
      return hit;
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
    maybeSingle: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      const rows = op === "select" ? run() : (run(), written);
      return { data: rows[0] ?? null, error: rows[0] ? null : { message: "none" } };
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve({ data: run(), error: null }).then(res, rej),
  };
  return b;
}

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (name: string) => builder(name),
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
vi.mock("@/lib/org-type.server", () => ({
  isAffiliatedStrict: async () => false,
  orgTypeOfStrict: async () => "company",
}));

import { pushConversation } from "@/lib/mcp-handler.server";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1" };

async function push(args: Record<string, unknown>) {
  const res = await pushConversation(OWNER, args, 1);
  return (await res.json()) as {
    result?: { content: { text: string }[]; structuredContent: Record<string, unknown> };
    error?: { message: string };
  };
}

const ART = "An artifact the chat made, long enough to stand on its own and not repeat any message.";
const base = (extra: Record<string, unknown> = {}) => ({
  vendor: "claude",
  orig_conversation_id: "conv-1",
  messages: [
    { role: "user", content: "Please draft the plan." },
    { role: "assistant", content: "Here is the plan as an artifact." },
  ],
  ...extra,
});

function thread() {
  return table("work_items").find((r) => r["type"] === "ai_thread")!;
}
function attachmentRows() {
  return table("work_items").filter((r) => r["type"] !== "ai_thread");
}

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  seq = 0;
});

describe("ID-2 parent link", () => {
  it("sets parent_work_item_id to the thread on a new attachment", async () => {
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART }] }));
    const [att] = attachmentRows();
    expect(att).toBeDefined();
    expect(att!["parent_work_item_id"]).toBe(thread()["id"]);
  });

  it("sets the parent on a file_ref placeholder", async () => {
    await push(base({ attachments: [{ kind: "file_ref", title: "Deck", source_artifact_id: "d1", file_ref: { filename: "deck.pptx" } }] }));
    expect(attachmentRows()[0]!["parent_work_item_id"]).toBe(thread()["id"]);
  });

  it("keeps an existing parent on a new version", async () => {
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART }] }));
    const att = attachmentRows()[0]!;
    att["parent_work_item_id"] = "keep-me";
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: `${ART} Now with one more line.` }] }));
    expect(attachmentRows()).toHaveLength(1);
    expect(attachmentRows()[0]!["parent_work_item_id"]).toBe("keep-me");
  });

  it("fills a missing parent on a new version", async () => {
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART }] }));
    attachmentRows()[0]!["parent_work_item_id"] = null;
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: `${ART} Now with one more line.` }] }));
    expect(attachmentRows()[0]!["parent_work_item_id"]).toBe(thread()["id"]);
  });
});

describe("ID-2 turn link", () => {
  it("links the named position when it exists", async () => {
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART, produced_at_turn: 2 }] }));
    const turn2 = table("turns").find((t) => t["turn_no"] === 2)!;
    expect(attachmentRows()[0]!["produced_at_turn_id"]).toBe(turn2["id"]);
    expect(events.find((e) => e.eventType === "mcp.push")!.dims["turn_linked_attachments"]).toBe("1");
  });

  it("reads source_meta.produced_at_turn too", async () => {
    await push(base({ attachments: [{ kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART, source_meta: { produced_at_turn: 1 } }] }));
    const turn1 = table("turns").find((t) => t["turn_no"] === 1)!;
    expect(attachmentRows()[0]!["produced_at_turn_id"]).toBe(turn1["id"]);
  });

  it("leaves it null when the position does not exist or was not named", async () => {
    await push(base({
      attachments: [
        { kind: "artifact_markdown", title: "Plan", source_artifact_id: "a1", content: ART, produced_at_turn: 9 },
        { kind: "artifact_markdown", title: "Other", source_artifact_id: "a2", content: `${ART} Second.` },
      ],
    }));
    for (const row of attachmentRows()) expect(row["produced_at_turn_id"] ?? null).toBeNull();
    expect(events.find((e) => e.eventType === "mcp.push")!.dims["turn_linked_attachments"]).toBe("0");
  });
});

describe("ID-2 conversation id", () => {
  it("returns lasso_conversation_id in the response", async () => {
    const out = await push(base());
    const id = thread()["id"] as string;
    expect(out.result!.content[0]!.text).toContain(`\nlasso_conversation_id: ${id}\n`);
    expect(out.result!.structuredContent["lasso_conversation_id"]).toBe(id);
  });

  it("targets the named thread when the caller owns it", async () => {
    await push(base());
    const id = thread()["id"] as string;
    const out = await push(base({
      orig_conversation_id: "different-key",
      lasso_conversation_id: id,
      messages: [...base().messages as Row[], { role: "user", content: "One more thing." }],
    }));
    expect(out.error).toBeUndefined();
    expect(table("work_items").filter((r) => r["type"] === "ai_thread")).toHaveLength(1);
    expect(table("turns")).toHaveLength(3);
  });

  it("rejects an unknown id and writes nothing", async () => {
    const out = await push(base({ lasso_conversation_id: "00000000-0000-4000-8000-999999999999" }));
    expect(out.error?.message).toContain("lasso_conversation_id");
    expect(table("work_items")).toHaveLength(0);
    expect(table("turns")).toHaveLength(0);
  });

  it("rejects a thread owned by someone else and writes nothing", async () => {
    table("work_items").push({ id: "00000000-0000-4000-8000-00000000abcd", owner_id: "someone-else", type: "ai_thread", orig_conversation_id: "x" });
    const out = await push(base({ lasso_conversation_id: "00000000-0000-4000-8000-00000000abcd" }));
    expect(out.error).toBeDefined();
    expect(table("work_items")).toHaveLength(1);
    expect(table("turns")).toHaveLength(0);
  });
});
