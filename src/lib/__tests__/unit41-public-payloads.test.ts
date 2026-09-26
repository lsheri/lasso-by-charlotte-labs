import { describe, expect, it } from "vitest";

import type { SharedBoardDto, SharedSeedWork } from "../board-share-shared";
import { demoSafeBoard, seededPreview } from "../demo-board.server";
import { publicDemoPresets } from "../demo-presets-shared";
import { publicSafeWork } from "../public-work-allowlist";
import { publicSafeTurnExcerpts } from "../public-work-allowlist";

const BAD_KEY = /(owner|org|client|task|profile|user|import_session)_?id|url|link|content_ref|content_hash|storage/i;

function walk(value: unknown, path: string, bad: string[]): void {
  if (typeof value === "string") {
    if (/^(https?:|\/\/)/i.test(value.trim())) bad.push(`${path} = ${value}`);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) return value.forEach((v, i) => walk(v, `${path}[${i}]`, bad));
  for (const [k, v] of Object.entries(value)) {
    if (BAD_KEY.test(k)) bad.push(`${path}.${k}`);
    walk(v, `${path}.${k}`, bad);
  }
}

function clean(label: string, payload: unknown) {
  const bad: string[] = [];
  walk(payload, label, bad);
  expect(bad).toEqual([]);
}

const dirty = (id: string, type: string): SharedSeedWork =>
  ({
    id,
    title: "Q3 margin",
    type,
    source: "claude",
    visibility: "mapped",
    captured_at: "2026-09-01T00:00:00Z",
    content_ref: "storage/key",
    content_hash: "abc",
    owner_id: "u1",
    org_id: "o1",
    client_id: "c1",
    profile_id: "p1",
    user_id: "u2",
    import_session_id: "i1",
    task_id: "t9",
    taskIds: ["t1"],
    url: "https://claude.ai/chat/abc",
    web_view_link: "https://drive",
    storage_path: "bucket/x",
    notes: "private note",
    orig_conversation_id: "conv-real",
    source_meta: { vendor: "claude", url: "https://x", drive_file_id: "d1", filename: "//cdn/x" },
    meta: { owner_profile_id: "p1", web_view_link: "https://x", mime_type: "application/pdf" },
  }) as never;

const board: SharedBoardDto = {
  board: { viewerProfileId: null } as never,
  seed: { brief: null, tasks: [{ id: "t1", name: "Task", detail: null }], work: [dirty("w1", "ai_thread"), dirty("w2", "document")], decisions: [] },
  cardPreviews: {},
  filePreviews: {},
  turns: {},
  expiresAt: "2026-09-27T00:00:00Z",
};

describe("unit 4.1 every public payload passes the allowlist", () => {
  it("share link work", () => clean("share", publicSafeWork(board.seed.work)));

  it("demo board", () => clean("board", demoSafeBoard(board).seed));

  it("demo home thumbnails", () => clean("home", { code: "YSM-01", title: "t", clientLabel: null, workCount: 2, preview: seededPreview(demoSafeBoard(board)) }));

  it("demo presets", () => {
    const work = demoSafeBoard(board).seed.work;
    const presets = publicDemoPresets(
      [{ position: 1, question: "q", answer: "See https://x.y and w1", context_manifest: null, turn_refs: [{ work_item_id: "w1", turn_no: 2, label: "Turn 2" }], generated_at: null }],
      new Set(work.map((w) => w.id)),
    );
    clean("presets", presets);
  });

  it("demo conversations", () => {
    const items = demoSafeBoard(board).seed.work.map((item) => ({ code: "YSM-01", item }));
    clean("conversations", { items, turns: {}, filePreviews: {} });
  });

  it("landing proof carries demo-only safe turn excerpts without private ids", () => {
    const proof = {
      itemId: "w1",
      title: "Partnership scenarios: year-two net benefit",
      vendor: "claude",
      turns: publicSafeTurnExcerpts([
        { id: "turn-private", turn_no: 2, role: "assistant", content: "From https://private.example for 6d3262dc-32c2-4910-b951-ccee79d82135", ts: "2026-08-28T23:07:00Z", model: "private-model" },
      ], 2, 6),
    };
    clean("landing.proof", proof);
    expect(proof.turns[0]).toEqual({ turn_no: 2, role: "assistant", content: "From for", ts: "2026-08-28T23:07:00Z" });
    expect(readFileSync("src/lib/demo-board.server.ts", "utf8")).toContain("proofItem ?");
    expect(readFileSync("src/lib/demo-board.server.ts", "utf8")).toContain("publicSafeTurnExcerpts(board.turns[proofItem.id] ?? [], 2, 6)");
  });

  it("keeps what visible features read", () => {
    const [a] = publicSafeWork(board.seed.work);
    expect(a).toMatchObject({ id: "w1", title: "Q3 margin", type: "ai_thread", source: "claude", orig_conversation_id: "group-1", placedIn: ["t1"] });
    expect(a!.source_meta).toEqual({ vendor: "claude" });
    expect(a!.meta).toEqual({ mime_type: "application/pdf" });
  });
});
