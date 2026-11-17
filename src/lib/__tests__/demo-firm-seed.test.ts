// Liam, 16 Nov: the demo firm seed. The plan lays every board out inside its frames; the writer stays inside the
// marked demo workspace and the kestrelbay.test domain, keeps private and unplaced items out of the firm's reach,
// and records the version each client saw.
import { describe, expect, it } from "vitest";

import { b05 } from "@/lib/demo-firm/boards/b05-st-brigid";
import { b30 } from "@/lib/demo-firm/boards/b30-ashbury-peak";
import { CARD_H, CARD_W, CONTENT_FIDELITIES, NO_WORKSTREAM_TOP, planBoard, slideMap, sourceFor } from "@/lib/demo-firm/plan";
import { DEMO_FIRM_MARKER, seedDemoBoard } from "@/lib/demo-firm/seed.server";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";

let counter = 0;
const id = () => `id-${++counter}`;

describe("the layout plan", () => {
  const plan = planBoard(b05, id, (name) => `task-${name}`);

  it("puts every placed item on a card inside its frame", () => {
    const placed = b05.items.filter((item) => item.placed !== false);
    expect(plan.cards).toHaveLength(placed.length);
    for (const card of plan.cards) {
      const item = b05.items.find((entry) => entry.key === card.itemKey)!;
      const frame = plan.frames.find((entry) => entry.label === item.section)!;
      expect(card.x).toBeGreaterThanOrEqual(frame.x);
      expect(card.y).toBeGreaterThanOrEqual(frame.y);
      expect(card.x + CARD_W).toBeLessThanOrEqual(frame.x + frame.w);
      expect(card.y + CARD_H).toBeLessThanOrEqual(frame.y + frame.h);
    }
  });

  it("files cards only into workstream outlines, never into sections", () => {
    for (const card of plan.cards) {
      const item = b05.items.find((entry) => entry.key === card.itemKey)!;
      expect(card.frameId !== null).toBe((b05.workstreams ?? []).includes(item.section));
    }
    expect(plan.frames.filter((frame) => frame.kind === "custom").every((frame) => frame.key.startsWith("section:") && frame.sequenceNo)).toBe(true);
    expect(plan.frames.filter((frame) => frame.kind === "task").map((frame) => frame.key)).toContain("task:task-Launch");
  });

  it("draws produced and informed links between cards", () => {
    expect(plan.links).toContainEqual({ fromItem: "research-chat", toItem: "bundle-brief", relation: "produced" });
    expect(plan.links).toContainEqual({ fromItem: "int-cmo", toItem: "steerco1", relation: "informed" });
  });

  it("names sources the way real captures do", () => {
    expect(sourceFor("granola", "call")).toEqual({ source: "connector:granola", sourceVendor: "granola", fidelity: "transcribed" });
    expect(sourceFor("claude", "ai_thread").source).toBe("mcp:claude");
    expect(sourceFor("google_slides", "deck").sourceVendor).toBe("gdrive");
  });

  it("keeps sections clear of the empty Workstreams box on boards without workstreams", () => {
    // The first look at the seeded Ashbury board showed that box sitting on the Intake section.
    const flat = planBoard(b30, id, () => "none");
    expect(b30.workstreams ?? []).toHaveLength(0);
    expect(flat.frames.every((frame) => frame.y >= NO_WORKSTREAM_TOP)).toBe(true);
    expect(plan.frames.filter((frame) => frame.kind === "custom").every((frame) => frame.y === 0)).toBe(true);
  });

  it("turns a deck's slide headings into the map its card previews", () => {
    const map = slideMap("## Slide 1\nFund II targets $150M.\nSource: thesis.\n\n## Slide 2\nFund I returned 2.1x.");
    expect(map.slides).toEqual([
      { title: "Fund II targets $150M.", lines: ["Source: thesis."] },
      { title: "Fund I returned 2.1x.", lines: [] },
    ]);
  });

  it("uses only fidelities the database accepts, for every vendor and type", () => {
    // The first live run stopped here: "full" is not an accepted fidelity.
    for (const vendor of ["claude", "chatgpt", "granola", "google_docs", "google_slides", "upload"] as const) {
      for (const type of ["document", "deck", "ai_thread", "call", "sheet", "email"] as const) {
        expect(CONTENT_FIDELITIES).toContain(sourceFor(vendor, type).fidelity);
      }
    }
  });
});

type Write = { table: string; rows: Record<string, unknown>[] };

/** Just enough of the Supabase client for the writer: records inserts, answers the reads it makes. */
function fakeAdmin() {
  const writes: Write[] = [];
  const uploads: string[] = [];
  const users = new Map(DEMO_PEOPLE.map((person) => [`u-${person.key}`, `${person.key}@kestrelbay.test`]));
  const chain = (table: string) => {
    let rows: Record<string, unknown>[] = [];
    let mode: "select" | "insert" = "select";
    const api = {
      insert(value: Record<string, unknown> | Record<string, unknown>[]) {
        mode = "insert";
        rows = (Array.isArray(value) ? value : [value]).map((row) => ({ id: row["id"] ?? id(), ...row }));
        writes.push({ table, rows });
        return api;
      },
      select() {
        return api;
      },
      eq() {
        return api;
      },
      single: async () => ({ data: rows[0], error: null }),
      maybeSingle: async () => {
        if (table === "orgs") return { data: { id: "org-demo" }, error: null };
        return { data: null, error: null };
      },
      then(resolve: (value: unknown) => void) {
        if (mode === "insert") return resolve({ data: rows, error: null });
        if (table === "profiles") return resolve({ data: DEMO_PEOPLE.map((person) => ({ id: `p-${person.key}`, user_id: `u-${person.key}` })), error: null });
        return resolve({ data: [], error: null });
      },
    };
    return api;
  };
  const admin = {
    from: chain,
    storage: { from: () => ({ upload: async (path: string) => (uploads.push(path), { data: { path }, error: null }) }) },
    auth: { admin: { getUserById: async (uid: string) => ({ data: { user: { id: uid, email: users.get(uid) } }, error: null }) } },
  };
  return { admin: admin as never, writes, uploads };
}

describe("the writer", () => {
  it("seeds one board inside the demo workspace, keeping private and unplaced work out of reach", async () => {
    const { admin, writes, uploads } = fakeAdmin();
    const board = { ...b05, items: [...b05.items, { ...b05.items[1]!, key: "loose", title: "Unplaced note", placed: false }] };
    const actedAs: string[] = [];
    const result = await seedDemoBoard(admin, board, async (email) => (actedAs.push(email), admin));
    expect(actedAs).toEqual(["hollis@kestrelbay.test"]);
    expect(result.skipped).toBe(false);

    const of = (table: string) => writes.filter((write) => write.table === table).flatMap((write) => write.rows);
    const engagement = of("engagements")[0]!;
    expect(engagement).toMatchObject({ org_id: "org-demo", owner_id: "p-pereira", code: "", shared_with_firm: true });
    expect(of("engagement_members").map((row) => row["profile_id"])).toEqual(board.team.map((key) => `p-${key}`));

    const items = of("work_items");
    expect(items.every((row) => row["org_id"] === "org-demo")).toBe(true);
    expect(items.every((row) => (row["source_meta"] as Record<string, unknown>)["demo_board"] === "b5")).toBe(true);
    expect(items.find((row) => row["title"] === "My notes: stakeholder dynamics")!["visibility"]).toBe("private");
    const loose = items.find((row) => row["title"] === "Unplaced note")!;
    expect(of("work_item_tasks").some((row) => row["work_item_id"] === loose["id"])).toBe(false);

    // Text lives in storage for documents and in turns for chats; every item gets its index card.
    expect(uploads).toHaveLength(board.items.filter((item) => item.type !== "ai_thread").length);
    expect(uploads.every((path) => path.startsWith("u-"))).toBe(true);
    expect(of("turns").length).toBe(board.items.find((item) => item.type === "ai_thread")!.turns!.length);
    expect(of("work_item_extracts")).toHaveLength(board.items.length);

    // Client marks keep the content hash of the version shown.
    const marks = of("client_showings");
    expect(marks).toHaveLength(board.items.reduce((sum, item) => sum + (item.shown?.length ?? 0), 0));
    expect(marks.every((row) => typeof row["content_hash"] === "string" && (row["content_hash"] as string).length === 64)).toBe(true);
    expect(of("workboard_nodes").filter((row) => row["kind"] === "sticky")).toHaveLength(board.stickies!.length);
    const versions = of("document_versions");
    expect(versions).toHaveLength(board.items.filter((item) => item.type === "deck").length);
    expect(versions.every((row) => (row["slide_map"] as { slides: unknown[] }).slides.length >= 4)).toBe(true);
  });

  it("is scoped to one marked workspace", () => {
    expect(DEMO_FIRM_MARKER).toBe("kestrel-bay");
  });
});
