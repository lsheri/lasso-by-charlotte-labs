// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { parseWorkboardStickyBody, serializeWorkboardStickyBody } from "@/lib/canvas-lab-shared";
import { applyDurableBoard, type LabNode } from "@/components/canvas-lab/canvas-lab-model";
import { stickyBodyOf } from "@/components/canvas-lab/LabSticky";
import { createComment, createReply, editComment } from "@/lib/canvas-lab-annotations.server";
import { sharedNodeBody } from "@/lib/board-share-open.server";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedProfile } from "@/lib/profile-resolve";

vi.mock("@/lib/canvas-lab.server", () => ({ boardSeatFor: async (_db: unknown, _engagement: unknown, profile: unknown) => profile, ensureBoard: async () => ({ id: "b" }), findBoardFor: async () => ({ id: "b" }), ensureWorkItemNode: async () => "n", isEngagementEditor: async () => true }));
vi.mock("@/lib/telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: vi.fn() }));
vi.mock("../telemetry.server", () => ({ sha256Hex: async () => "h", recordEvent: vi.fn() }));
const mention = { profileId: "ben", label: "Ben Stanton", start: 4, length: 12 };
const body = { text: "Ask @Ben Stanton", mentions: [mention], size: "body", weight: "regular", colour: "ink", fill: "yellow" } as const;
const profile = { id: "me" } as ResolvedProfile;

function memoryDb() {
  let row: Record<string, unknown> = { id: "c", parent_id: null, workboard_id: "b", work_item_id: "w", node_id: "n", turn_no: 1, char_start: 0, char_end: 5, excerpt: "Hello", turn_hash: "h", body: "", mentions: [], author_profile_id: "me", version: 1, created_at: "2026-10-23T00:00:00Z", updated_at: "2026-10-23T00:00:00Z", archived_at: null, visibility: "engagement" };
  const writes: Record<string, unknown>[] = [];
  const db = { from(table: string) {
    const result = () => ({ data: table === "turns" ? { content: "Hello world", content_hash: "h" } : table === "workboards" ? { engagement_id: "e" } : { ...row }, error: null });
    const chain = { select: vi.fn(() => chain), eq: vi.fn(() => chain), is: vi.fn(() => chain), insert: vi.fn((value: Record<string, unknown>) => { writes.push(value); row = { ...row, ...value }; return chain; }), update: vi.fn((value: Record<string, unknown>) => { writes.push(value); row = { ...row, ...value, version: Number(row["version"]) + 1 }; return chain; }), single: async () => result(), maybeSingle: async () => result() };
    return chain;
  } };
  return { db: db as unknown as SupabaseClient<Database>, writes };
}

describe("MENTION-1b storage", () => {
  it("round trips sticky mentions and clamps deleted offsets", () => {
    const input = { ...body, mentions: [...body.mentions] };
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody(input))).toEqual(input);
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody({ ...input, text: "Ask" }))?.mentions).toEqual([]);
  });
  it("shared sticky copies keep words and style while dropping rich markup and mentions", () => {
    const input = { ...body, html: "<p>Ask @Ben Stanton</p>", mentions: [mention] };
    const shared = sharedNodeBody("sticky", serializeWorkboardStickyBody(input));
    const { mentions: _mentions, ...plain } = body;
    const parsed = parseWorkboardStickyBody(shared);
    expect(parsed).toEqual(plain);
    expect(parsed && "mentions" in parsed).toBe(false);
    expect(shared).not.toContain("html");
    expect(shared).not.toContain("mentions");
  });
  it("keeps legacy sticky bodies unchanged and retains mentions through the durable model", () => {
    const { mentions, ...legacy } = body;
    expect(parseWorkboardStickyBody(serializeWorkboardStickyBody(legacy))).toEqual(legacy);
    const model = applyDurableBoard({ frames: [], nodes: [] }, { id: "b", engagementId: "e", version: 1, frames: [], links: [], viewerProfileId: "me", canEditStructure: true, archivedContextFrame: null, nodes: [{ id: "s", frameId: null, kind: "sticky", workItemId: null, decisionId: null, authorProfileId: "me", authorName: "Me", title: "", body: serializeWorkboardStickyBody({ ...body, mentions: [...mentions] }), judgmentType: null, x: 0, y: 0, w: 260, h: 160, hidden: false, version: 1, referenceReadable: true }] });
    expect(stickyBodyOf(model.nodes[0] as LabNode).mentions).toEqual(mentions);
  });
  it("a comment survives create and edit with structured mentions", async () => {
    const { db, writes } = memoryDb();
    const created = await createComment(db, profile, { engagementId: "e", workItemId: "w", turnNo: 1, charStart: 0, charEnd: 5, clientKey: "key", body: body.text, mentions: [mention] });
    expect(created).toMatchObject({ status: "saved", comment: { body: body.text, mentions: [mention] } });
    const edited = await editComment(db, profile, "c", `${body.text} please`, 1, [mention]);
    expect(edited).toMatchObject({ status: "saved", comment: { body: `${body.text} please`, mentions: [mention] } });
    expect(writes.map((write) => write["mentions"])).toEqual([[mention], [mention]]);
  });
  it("replies also write and read mentions and edit removes stale offsets", async () => {
    const { db, writes } = memoryDb();
    expect(await createReply(db, profile, { parentId: "c", body: body.text, clientKey: "r", mentions: [mention] })).toMatchObject({ status: "saved", comment: { mentions: [mention] } });
    expect(await editComment(db, profile, "c", "Ask", 1, [mention])).toMatchObject({ status: "saved", comment: { body: "Ask", mentions: [] } });
    expect(writes[1]?.["mentions"]).toEqual([]);
  });
});