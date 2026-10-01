import { beforeEach, describe, expect, it, vi } from "vitest";

/** R1: a text rendition can ride on a file_ref. */

type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const uploads: { path: string; opts: Record<string, unknown> }[] = [];
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
    storage: { from: () => ({ upload: async (path: string, _b: unknown, opts: Record<string, unknown>) => (uploads.push({ path, opts }), { error: null }), download: async () => ({ data: null }) }) },
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

import { createHash } from "node:crypto";
import { ATTACHMENT_KINDS } from "@/lib/conversation-shared";
import { parseIncomingAttachment, pushConversation, renditionNote, type AttachmentOutcome } from "@/lib/mcp-handler.server";
import { readFileSync } from "node:fs";

const OWNER = { tokenId: "t1", profileId: "p1", orgId: "o1", userId: "u1", kind: "link", readOnly: false, legacy: true, authKind: "link" as const };
const TEXT = "# Slide 1\n\n- Revenue grew\n";
const SHA = createHash("sha256").update(TEXT).digest("hex");

async function push(args: Record<string, unknown>) {
  const res = await pushConversation(OWNER, args, 1);
  return (await res.json()) as { result: { content: { text: string }[]; structuredContent: Record<string, unknown> } };
}
const ref = (rendition: unknown) => ({ kind: "file_ref", title: "Deck", source_artifact_id: "d1", file_ref: { filename: "deck.pptx", ...(rendition === undefined ? {} : { rendition }) } });
const base = (att: unknown) => ({
  vendor: "claude",
  orig_conversation_id: "conv-1",
  messages: [{ role: "user", content: "Make a deck." }, { role: "assistant", content: "Here is the deck." }],
  attachments: [att],
});
const placeholder = () => table("work_items").find((r) => r["type"] !== "ai_thread")!;
const dims = () => events.find((e) => e.eventType === "mcp.push")!.dims;
const outcome = (out: Awaited<ReturnType<typeof push>>) =>
  (out.result.structuredContent["attachments"] as AttachmentOutcome[]).find((o) => o.title === "Deck")!;

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  events.length = 0;
  uploads.length = 0;
  seq = 0;
});

describe("R1 parse", () => {
  it("puts a valid rendition beside an unchanged fileRef", () => {
    const r = parseIncomingAttachment(ref({ method: "extracted_by_script", content: TEXT, sha256: SHA.toUpperCase() }), ATTACHMENT_KINDS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.attachment.fileRef).toEqual({ filename: "deck.pptx" });
      expect(r.attachment.rendition).toEqual({ format: "markdown", method: "extracted_by_script", content: TEXT, sha256: SHA });
    }
  });
  it("accepts a stringified rendition", () => {
    const r = parseIncomingAttachment(ref(JSON.stringify({ method: "written_by_model", content: "x", format: "html" })), ATTACHMENT_KINDS);
    expect(r.ok && r.attachment.rendition?.format).toBe("html");
  });
  it.each([
    [{ content: TEXT }],
    [{ method: "extracted_by_script", content: TEXT, format: "pdf" }],
    [{ method: "extracted_by_script", content: "" }],
    [{ method: "extracted_by_script", content: "a".repeat(200 * 1024 + 1) }],
    [{ method: "extracted_by_script", content: TEXT, sha256: "nope" }],
  ])("a bad rendition gives renditionIssue and still ok", (bad) => {
    const r = parseIncomingAttachment(ref(bad), ATTACHMENT_KINDS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.attachment.renditionIssue).toBeTruthy();
      expect(r.attachment.rendition).toBeUndefined();
    }
  });
});

describe("R1 renditionNote", () => {
  const o = (x: Partial<AttachmentOutcome>): AttachmentOutcome => ({ title: "t", source_artifact_id: "s", outcome: "reference_created", chars: 0, ...x });
  it("words each case", () => {
    expect(renditionNote([o({})])).toBe("");
    expect(renditionNote([o({ rendition: "stored", rendition_match: "yes" })])).toBe(" 1 rendition stored with the file placeholders; they are shown as renditions, never as the files.");
    expect(renditionNote([o({ rendition: "stored", rendition_match: "no" })])).toContain("A rendition changed after its script made it; send the script's output unchanged.");
  });
});

describe("R1 push", () => {
  it("stores a matching rendition on a new placeholder", async () => {
    const out = await push(base(ref({ method: "extracted_by_script", content: TEXT, sha256: SHA })));
    const row = placeholder();
    expect(row["content_fidelity"]).toBe("reference");
    expect(row["content_ref"]).toBeNull();
    expect((row["source_meta"] as { rendition: { match: string } }).rendition.match).toBe("yes");
    expect(uploads).toHaveLength(1);
    expect(uploads[0]!.opts["upsert"]).toBe(false);
    expect(uploads[0]!.path).toContain("/rendition-");
    expect(outcome(out).rendition).toBe("stored");
    expect(dims()["renditions"]).toBe("1");
    expect(dims()["renditions_changed"]).toBe("0");
  });

  it("marks a changed rendition", async () => {
    const out = await push(base(ref({ method: "extracted_by_script", content: TEXT, sha256: "b".repeat(64) })));
    expect((placeholder()["source_meta"] as { rendition: { match: string } }).rendition.match).toBe("no");
    expect(dims()["renditions_changed"]).toBe("1");
    expect(JSON.stringify(out.result.structuredContent["notes"])).toContain("changed after its script made it");
  });

  it("merges into an existing placeholder still waiting for its file", async () => {
    await push(base(ref(undefined)));
    const out = await push(base(ref({ method: "extracted_by_script", content: TEXT })));
    const row = placeholder();
    expect(table("work_items").filter((r) => r["type"] !== "ai_thread")).toHaveLength(1);
    expect(row["content_fidelity"]).toBe("reference");
    const meta = row["source_meta"] as Record<string, unknown>;
    expect(meta["filename"]).toBe("deck.pptx");
    expect((meta["rendition"] as { match: string }).match).toBe("unknown");
    expect(outcome(out).rendition).toBe("stored");
  });

  it("stores nothing once the original file is present", async () => {
    await push(base(ref(undefined)));
    placeholder()["content_fidelity"] = "verbatim";
    const out = await push(base(ref({ method: "extracted_by_script", content: TEXT })));
    expect(uploads).toHaveLength(0);
    expect(outcome(out).rendition).toBe("ignored_original_present");
  });

  it("tells the AI to send it unchanged", () => {
    expect(readFileSync("src/lib/mcp-handler.server.ts", "utf8")).toContain("send it unchanged as file_ref.rendition");
  });
});
