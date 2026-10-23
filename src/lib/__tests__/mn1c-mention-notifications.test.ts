import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { captureStickyMentions, newMentionIds, notifySavedMentions, notifySavedStickies } from "@/lib/mention-notifications.server";
import { createComment, createReply, editComment } from "@/lib/canvas-lab-annotations.server";
import { serializeWorkboardStickyBody } from "@/lib/canvas-lab-shared";
import { guardWorkboardEvent, WORKBOARD_EVENT_DIMS } from "@/lib/workboard-event-allowlist";
import type { ResolvedProfile } from "@/lib/profile-resolve";

const mocks = vi.hoisted(() => ({ notify: vi.fn(async (_name: string, _args: Record<string, unknown>) => ({ error: null })), record: vi.fn() }));
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { rpc: mocks.notify } }));
vi.mock("@/lib/telemetry.server", () => ({ recordEvent: mocks.record, sha256Hex: async () => "hash" }));
vi.mock("@/lib/canvas-lab.server", () => ({ boardSeatFor: async (_db: unknown, _engagement: unknown, profile: unknown) => profile, ensureBoard: async () => ({ id: "wb" }), ensureWorkItemNode: async () => "node", isEngagementEditor: async () => true }));

const profile = { id: "me", org_id: "org", role: "em" } as ResolvedProfile;
const ben = { profileId: "ben", label: "Ben Stanton", start: 4, length: 12 };
const other = { ...ben, profileId: "outsider" };
const stickyBody = (mentions = [ben]) => serializeWorkboardStickyBody({ text: "Ask @Ben Stanton", mentions, size: "body", weight: "regular", colour: "ink", fill: "yellow" });

function memoryDb(options: { editor?: boolean; members?: string[]; previous?: typeof ben[]; readError?: boolean } = {}) {
  let row: Record<string, unknown> = { id: "comment", workboard_id: "wb", kind: "sticky", body: "Ask @Ben Stanton", mentions: options.previous ?? [], version: 1, author_profile_id: "me", parent_id: null, work_item_id: "w", node_id: "node", turn_no: 1, char_start: 0, char_end: 5, excerpt: "Hello", turn_hash: "hash", created_at: "2026-10-23T00:00:00Z", updated_at: "2026-10-23T00:00:00Z", archived_at: null, visibility: "engagement" };
  const rpc = vi.fn(async (name: string) => ({ data: name === "is_engagement_editor" ? options.editor !== false : (options.members ?? ["ben", "me"]).map((id) => ({ profile_id: id, display_name: id })), error: null }));
  const from = vi.fn((table: string) => {
    let write = false;
    const result = () => ({ data: table === "profiles" ? { display_name: "Liam Sheridan", user_id: "user" } : table === "engagements" ? { title: "Pricing", org_id: "org" } : table === "workboards" ? { id: "wb", engagement_id: "eng" } : table === "turns" ? { content: "Hello world", content_hash: "hash" } : table === "workboard_nodes" ? { id: "node", kind: "sticky", body: stickyBody(options.previous ?? []) } : { ...row }, error: options.readError && !write ? { message: "Unavailable" } : null });
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain), insert: vi.fn((value: Record<string, unknown>) => { write = true; row = { ...row, ...value }; return chain; }), update: vi.fn((value: Record<string, unknown>) => { write = true; row = { ...row, ...value }; return chain; }), single: async () => result(), maybeSingle: async () => result() };
    return chain;
  });
  return { db: { rpc, from } as unknown as SupabaseClient<Database>, rpc, from };
}
beforeEach(() => vi.clearAllMocks());

describe("MENTION-1c authorization and privacy", () => {
  it("drops a named non-member silently", async () => {
    await notifySavedMentions(memoryDb().db, profile, "eng", "workboard_node", "node", [], [other]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("requires the editor RPC before reading members", async () => {
    const { db, rpc } = memoryDb({ editor: false });
    await notifySavedMentions(db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("is_engagement_editor", { eng: "eng" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("does nothing without a resolved profile", async () => {
    const { db, rpc } = memoryDb();
    await notifySavedMentions(db, null, "eng", "workboard_node", "node", [], [ben]);
    expect(rpc).not.toHaveBeenCalled();
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("drops self and de-duplicates recipients", async () => {
    await notifySavedMentions(memoryDb().db, profile, "eng", "workboard_node", "node", [], [ben, ben, { ...ben, profileId: "me" }]);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.notify.mock.calls[0]?.[1]).toMatchObject({ p_recipient: "ben" });
  });
  it("unchanged mention sets and label typos produce no notification", async () => {
    await notifySavedMentions(memoryDb().db, profile, "eng", "workboard_node", "node", [ben], [{ ...ben, label: "Ben", start: 9 }]);
    expect(newMentionIds([ben], [ben, other, other])).toEqual(["outsider"]);
    expect(mocks.notify).not.toHaveBeenCalled();
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("payload contains exactly the two names, never the saved body or identifiers", async () => {
    await notifySavedMentions(memoryDb().db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify).toHaveBeenCalledWith("notify", {
      p_recipient: "ben", p_org: "org", p_kind: "mention_received", p_section: "updates", p_subject_type: "workboard_node", p_subject_id: "node", p_group_key: "mention:workboard_node:node:ben", p_payload: { by: "Liam Sheridan", board: "Pricing" },
    });
    const args = mocks.notify.mock.calls[0]?.[1] as unknown as { p_payload: unknown };
    expect(JSON.stringify(args.p_payload)).not.toContain("Ask @Ben Stanton");
    expect(Object.keys(args.p_payload as object)).toEqual(["by", "board"]);
  });
  it("fails closed when name reads fail", async () => {
    await notifySavedMentions(memoryDb({ readError: true }).db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("fails closed on editor or membership RPC errors", async () => {
    const editor = memoryDb();
    editor.rpc.mockRejectedValueOnce(new Error("Unavailable"));
    await notifySavedMentions(editor.db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify).not.toHaveBeenCalled();
    const members = memoryDb();
    members.rpc.mockResolvedValueOnce({ data: true, error: null }).mockRejectedValueOnce(new Error("Unavailable"));
    await notifySavedMentions(members.db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("keeps the same grouping key when a recipient is re-added", async () => {
    const { db } = memoryDb();
    await notifySavedMentions(db, profile, "eng", "workboard_node", "node", [], [ben]);
    await notifySavedMentions(db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify.mock.calls.map((call) => call[1]["p_group_key"])).toEqual(["mention:workboard_node:node:ben", "mention:workboard_node:node:ben"]);
  });
  it("event dimensions pass the runtime allowlist exactly, without raw counts", async () => {
    await notifySavedMentions(memoryDb({ members: ["ben", "outsider"] }).db, profile, "eng", "workboard_annotation", "comment", [], [ben, other]);
    const event = mocks.record.mock.calls[0]?.[1];
    expect(event).toMatchObject({ eventType: "workboard.mention_created", dims: { surface: "comment", count_band: "2_4" } });
    expect(WORKBOARD_EVENT_DIMS[event.eventType]).toEqual(["surface", "count_band"]);
    expect(guardWorkboardEvent(event.eventType, event.dims)).toEqual({ keep: true, dims: event.dims });
  });
});

describe("MENTION-FIX-1 notify results", () => {
  it("a rejected notify records no event", async () => {
    mocks.notify.mockResolvedValueOnce({ error: { message: "check constraint" } } as never);
    await notifySavedMentions(memoryDb().db, profile, "eng", "workboard_node", "node", [], [ben]);
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("count_band reflects recipients actually notified", async () => {
    mocks.notify.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "check constraint" } } as never);
    await notifySavedMentions(memoryDb({ members: ["ben", "outsider"] }).db, profile, "eng", "workboard_annotation", "comment", [], [ben, other]);
    expect(mocks.notify).toHaveBeenCalledTimes(2);
    expect(mocks.record.mock.calls[0]?.[1]).toMatchObject({ dims: { count_band: "1" } });
  });
});

describe("MENTION-1c save boundaries", () => {
  it("sticky compares the server-saved body, not the optimistic editor state", async () => {
    const { db } = memoryDb({ previous: [ben] });
    const before = await captureStickyMentions(db, "eng", { type: "node_update", nodeId: "node", expectedVersion: 1, patch: { body: stickyBody() } });
    await notifySavedStickies(db, profile, "eng", before, { status: "saved", boardId: "wb", boardVersion: 1, versions: { node: 2 } });
    expect(before).toMatchObject([{ previous: [ben], current: [ben] }]);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("failed sticky saves do not notify", async () => {
    const { db } = memoryDb();
    const before = await captureStickyMentions(db, "eng", { type: "node_update", nodeId: "node", expectedVersion: 1, patch: { body: stickyBody() } });
    await notifySavedStickies(db, profile, "eng", before, { status: "forbidden" });
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it("first materialized sticky notifies with its durable id", async () => {
    const { db } = memoryDb();
    const before = await captureStickyMentions(db, "eng", { type: "materialize", frames: [], nodes: [{ clientKey: "local", frameKey: null, kind: "sticky", body: stickyBody(), x: 0, y: 0, w: 200, h: 160 }] });
    await notifySavedStickies(db, profile, "eng", before, { status: "saved", boardId: "wb", boardVersion: 1, created: { nodes: { local: "node" } }, versions: {} });
    expect(mocks.notify.mock.calls[0]?.[1]).toMatchObject({ p_subject_id: "node" });
  });
  it("comment create and reply notify, unchanged edits do not", async () => {
    const { db } = memoryDb();
    expect(await createComment(db, profile, { engagementId: "eng", workItemId: "w", turnNo: 1, charStart: 0, charEnd: 5, clientKey: "key", body: "Ask @Ben Stanton", mentions: [ben] })).toMatchObject({ status: "saved" });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(await editComment(db, profile, "comment", "Ask @Ben Stanton please", 1, [ben])).toMatchObject({ status: "saved" });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
    expect(await createReply(db, profile, { parentId: "comment", clientKey: "reply", body: "Ask @Ben Stanton", mentions: [ben] })).toMatchObject({ status: "saved" });
    expect(mocks.notify).toHaveBeenCalledTimes(2);
  });
  it("new mentions on a comment edit notify and notification failures never fail saves", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("Unavailable"));
    expect(await editComment(memoryDb().db, profile, "comment", "Ask @Ben Stanton", 1, [ben])).toMatchObject({ status: "saved", comment: { mentions: [ben] } });
    expect(mocks.notify).toHaveBeenCalledTimes(1);
  });
});