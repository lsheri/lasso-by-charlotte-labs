// 19 Nov, Firm Brain Build Spec step 8, manager tools: the server functions called directly, as each kind of person,
// against an in-memory database that plays the two applied migrations' rules. Spec checks: a reading list holds only
// threads the reader may see; common questions show no names and nothing asked by fewer than five people; no view
// lists who asked what, or whose work was flagged.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeClient, type World } from "./manager-tools-fake-db";

type Client = ReturnType<typeof fakeClient>;
const state = vi.hoisted(() => ({ admin: null as unknown }));

// The service role client the gate imports: one stable object that always answers from the current test's world.
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: (table: string) => (state.admin as Client).from(table),
    rpc: (name: string, args: { p_org: string }) => (state.admin as Client).rpc(name, args),
  },
}));

import { readFirmCorpus, requireFirmMember } from "@/lib/firm-corpus.server";
import { guardServerEventDims } from "@/lib/event-dim-allowlist";
import {
  EXEMPLAR_COPY,
  firmAskedDims,
  READING_LIST_COPY,
  TOPIC_KINDS,
  validateBoardInput,
  validateExemplarInput,
  validatePinInput,
  validateProfileInput,
  type ExemplarWrite,
  type ReadingList,
  type ReadingWrite,
} from "@/lib/manager-tools-shared";
import {
  commonQuestionKindsCall,
  markExemplar,
  markExemplarCall,
  pinReadingThread,
  pinReadingThreadCall,
  readingListCall,
  unmarkExemplarCall,
  unpinReadingThreadCall,
  type CallContext,
} from "@/lib/manager-tools.server";

const id = (n: number) => `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, "0")}`;
const KESTREL = id(1);
const OTHER = id(2);
const P = { hollis: id(11), lee: id(12), quinn: id(13), yilmaz: id(14), pereira: id(15), coach: id(16), guest: id(17), gone: id(18), outsider: id(19) };
const B = { board: id(30), t1: id(31), t2: id(32), t3: id(33), t4: id(34), unshared: id(35), archived: id(36), elsewhere: id(37) };
const I = { sow1: id(41), sow2: id(42), sow3: id(43), sow4: id(44), secret: id(45), private1: id(46), guest1: id(47), onBoard: id(48), elsewhere: id(49) };
const user = (profileId: string) => `user-${profileId}`;

function freshWorld(): World {
  const profile = (pid: string, role: string, over: Partial<World["profiles"][number]> = {}): World["profiles"][number] => ({
    id: pid,
    user_id: user(pid),
    org_id: KESTREL,
    role,
    is_guest: false,
    deactivated_at: null,
    display_name: `Person ${pid.slice(-2)}`,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  });
  const board = (bid: string, title: string, over: Partial<World["engagements"][number]> = {}): World["engagements"][number] => ({
    id: bid,
    org_id: KESTREL,
    owner_id: P.pereira,
    title,
    brief: null,
    outcome: null,
    created_at: "2026-03-01T00:00:00Z",
    shared_with_firm: true,
    archived_at: null,
    clients: { name: `${title} client`, quick_folder: false },
    ...over,
  });
  const item = (iid: string, title: string, over: Partial<World["work_items"][number]> = {}): World["work_items"][number] => ({
    id: iid,
    org_id: KESTREL,
    owner_id: P.pereira,
    type: "document",
    title,
    display_title: null,
    visibility: "mapped",
    work_date: "2026-03-02",
    meta: { situation: "pricing" },
    ...over,
  });
  return {
    orgs: [
      { id: KESTREL, settings: { type: "company" } },
      { id: OTHER, settings: { type: "company" } },
    ],
    profiles: [
      profile(P.hollis, "admin"),
      profile(P.lee, "lead"),
      profile(P.quinn, "em"),
      profile(P.yilmaz, "em"),
      profile(P.pereira, "em"),
      profile(P.coach, "coach"),
      profile(P.guest, "em", { is_guest: true }),
      profile(P.gone, "admin", { deactivated_at: "2026-06-01T00:00:00Z" }),
      profile(P.outsider, "admin", { org_id: OTHER }),
    ],
    engagements: [
      board(B.board, "Marrowfield", { owner_id: P.quinn, shared_with_firm: false }),
      board(B.t1, "Thread one"),
      board(B.t2, "Thread two"),
      board(B.t3, "Thread three"),
      board(B.t4, "Thread four"),
      board(B.unshared, "Unshared lookalike", { shared_with_firm: false }),
      board(B.archived, "Archived thread", { archived_at: "2026-05-01T00:00:00Z" }),
      board(B.elsewhere, "Another firm's thread", { org_id: OTHER, owner_id: P.outsider }),
    ],
    engagement_members: [
      { engagement_id: B.board, profile_id: P.yilmaz },
      { engagement_id: B.board, profile_id: P.guest },
      { engagement_id: B.board, profile_id: P.coach },
    ],
    placements: [
      { work_item_id: I.sow1, engagement_id: B.t1 },
      { work_item_id: I.sow2, engagement_id: B.t2 },
      { work_item_id: I.sow3, engagement_id: B.t3 },
      { work_item_id: I.sow4, engagement_id: B.t4 },
      { work_item_id: I.secret, engagement_id: B.unshared },
      { work_item_id: I.private1, engagement_id: B.t1 },
      { work_item_id: I.guest1, engagement_id: B.t1 },
      { work_item_id: I.onBoard, engagement_id: B.board },
      { work_item_id: I.elsewhere, engagement_id: B.elsewhere },
    ],
    work_items: [
      item(I.sow1, "SOW one"),
      item(I.sow2, "SOW two"),
      item(I.sow3, "SOW three"),
      item(I.sow4, "SOW four"),
      item(I.secret, "Unshared SOW"),
      item(I.private1, "Private note", { visibility: "private" }),
      item(I.guest1, "Guest's file", { owner_id: P.guest }),
      item(I.onBoard, "Marrowfield draft", { owner_id: P.quinn }),
      item(I.elsewhere, "Another firm's SOW", { org_id: OTHER, owner_id: P.outsider }),
    ],
    work_item_extracts: [],
    client_showings: [],
    board_reading_pins: [],
    firm_exemplars: [],
    events: [],
    log: [],
    failNextInsert: null,
    now: "2026-11-19T12:00:00Z",
  };
}

let world: World;

beforeEach(() => {
  world = freshWorld();
  state.admin = fakeClient(world, "admin");
});

/**
 * Calls a server function's body as one person, the way a direct request would: no screen in between. The input goes
 * through the same validator the server function uses, then the same call (gate, role rule, read or write).
 */
async function call<I, T>(validate: (input: I) => I, run: (context: CallContext, data: I) => Promise<T>, profileId: string, data: Record<string, unknown>): Promise<T | number> {
  const context = { supabase: fakeClient(world, "user", user(profileId)), userId: user(profileId) } as unknown as CallContext;
  try {
    return await run(context, validate({ profile_id: profileId, ...data } as I));
  } catch (error) {
    if (error instanceof Response) return error.status;
    throw error;
  }
}

/** What the gate hands a call, built once so a test can send two requests at the same moment. */
async function contextFor(profileId: string) {
  const { profile, supabaseAdmin } = await requireFirmMember(fakeClient(world, "user", user(profileId)) as never, user(profileId), profileId);
  return { admin: supabaseAdmin, profile, corpus: await readFirmCorpus(supabaseAdmin, profile) };
}

const pin = (who: string, threadId: string, boardId = B.board) => call(validatePinInput, pinReadingThreadCall, who, { board_id: boardId, thread_id: threadId });
const unpin = (who: string, threadId: string, boardId = B.board) => call(validatePinInput, unpinReadingThreadCall, who, { board_id: boardId, thread_id: threadId });
const list = (who: string, boardId = B.board) => call(validateBoardInput, readingListCall, who, { board_id: boardId });
const mark = (who: string, itemId: string, engagementId?: string) => call(validateExemplarInput, markExemplarCall, who, { item_id: itemId, ...(engagementId ? { engagement_id: engagementId } : {}) });
const unmark = (who: string, itemId: string) => call(validateExemplarInput, unmarkExemplarCall, who, { item_id: itemId });
const titles = (result: ReadingList | number) => (typeof result === "number" ? result : result.pins.map((entry) => entry.title));

/** Every profile id and sign-in id in the fake firm: none may appear in anything sent to a browser. */
function namesAPerson(payload: unknown): boolean {
  const text = JSON.stringify(payload);
  return [...Object.values(P), ...Object.values(P).map(user)].some((value) => text.includes(value)) || /pinned_?by|marked_?by|actor_hash|profile_id|display_name|"lead"|"owner/i.test(text);
}

describe("who may pin to a board's reading list", () => {
  it("lets a workspace admin, a workspace lead and the board's owner pin, and nobody else", async () => {
    expect(await pin(P.hollis, B.t1)).toMatchObject({ ok: true });
    expect(await pin(P.lee, B.t2)).toMatchObject({ ok: true });
    expect(await pin(P.quinn, B.t3)).toMatchObject({ ok: true });
    expect(world.board_reading_pins.map((row) => row.slot).sort()).toEqual([1, 2, 3]);
  });

  it("refuses an analyst on the board, an owner of some other board, a coach, a guest and a deactivated admin", async () => {
    expect(await pin(P.yilmaz, B.t1)).toBe(403);
    // Pereira owns thread boards, not this one.
    expect(await pin(P.pereira, B.t1)).toBe(403);
    expect(await pin(P.coach, B.t1)).toBe(403);
    expect(await pin(P.guest, B.t1)).toBe(403);
    expect(await pin(P.gone, B.t1)).toBe(403);
    expect(world.board_reading_pins).toEqual([]);
  });

  it("lets an owner pin only on their own board", async () => {
    expect(await pin(P.pereira, B.t2, B.t1)).toMatchObject({ ok: true });
    expect(await pin(P.quinn, B.t2, B.t1)).toBe(403);
  });

  it("treats a board in another workspace as not there, for its own admin and for ours", async () => {
    expect(await pin(P.outsider, B.t1)).toBe(404);
    expect(await list(P.outsider)).toBe(404);
    expect(await unpin(P.outsider, B.t1)).toBe(404);
    expect(await pin(P.hollis, B.t1, B.elsewhere)).toBe(404);
    expect(world.board_reading_pins).toEqual([]);
  });

  it("applies the same rule to removing a pin", async () => {
    await pin(P.hollis, B.t1);
    for (const who of [P.yilmaz, P.pereira, P.coach, P.guest]) expect(await unpin(who, B.t1)).toBe(403);
    expect(world.board_reading_pins).toHaveLength(1);
    expect(await unpin(P.quinn, B.t1)).toMatchObject({ ok: true, list: { pins: [] } });
    expect(world.board_reading_pins).toEqual([]);
    // Removing one that is not there is not an error.
    expect(await unpin(P.hollis, B.t1)).toMatchObject({ ok: true });
  });
});

describe("a reading list holds only threads the reader may see", () => {
  it.each([
    ["an unshared board", B.unshared],
    ["an archived board", B.archived],
    ["another workspace's shared board", B.elsewhere],
    ["a board that does not exist", id(999)],
  ])("refuses %s in plain words and writes nothing", async (_what, threadId) => {
    expect(await pin(P.hollis, threadId)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedNotShared });
    expect(world.board_reading_pins).toEqual([]);
    expect(world.log.some((entry) => entry.table === "board_reading_pins" && entry.op === "insert")).toBe(false);
  });

  it("refuses a board pinned to itself", async () => {
    expect(await pin(P.pereira, B.t1, B.t1)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedSelf });
  });

  it("refuses a fourth pin, and a thread that is already on the list", async () => {
    for (const thread of [B.t1, B.t2, B.t3]) expect(await pin(P.hollis, thread)).toMatchObject({ ok: true });
    expect(await pin(P.hollis, B.t4)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedFull });
    expect(await pin(P.hollis, B.t1)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedAlready });
    expect(world.board_reading_pins).toHaveLength(3);
    const full = (await list(P.hollis)) as ReadingList;
    expect(full.full).toBe(true);
  });

  it("turns a refusal by the database itself into a plain line, never an error", async () => {
    world.failNextInsert = { table: "board_reading_pins", code: "23505", message: "duplicate key value violates unique constraint" };
    expect(await pin(P.hollis, B.t1)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedChanged });
    world.failNextInsert = { table: "board_reading_pins", code: "P0001", message: "only a thread shared with the firm can be pinned" };
    expect(await pin(P.hollis, B.t1)).toEqual({ ok: false, refusal: READING_LIST_COPY.refusedNotShared });
    world.failNextInsert = { table: "board_reading_pins", code: "XX000", message: "connection reset" };
    expect(await pin(P.hollis, B.t1)).toEqual({ ok: false, refusal: READING_LIST_COPY.failed });
  });

  it("keeps one pin when the same request is sent twice at once", async () => {
    const ctx = await contextFor(P.hollis);
    const send = () => pinReadingThread(ctx, { boardId: B.board, threadId: B.t1 });
    const [first, second] = await Promise.all([send(), send()]);
    expect(world.board_reading_pins).toHaveLength(1);
    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    const refused = [first, second].find((result) => !result.ok) as { refusal: string };
    expect([READING_LIST_COPY.refusedAlready, READING_LIST_COPY.refusedChanged]).toContain(refused.refusal);
  });

  it("shows the list to people on the board, and nothing to a member who is not on it", async () => {
    await pin(P.hollis, B.t1);
    await pin(P.hollis, B.t2);
    const onBoard = (await list(P.yilmaz)) as ReadingList;
    expect(onBoard.pins.map((entry) => [entry.slot, entry.title, entry.situation, entry.sourceItemId])).toEqual([
      [1, "Thread one", "Setting the right price", I.sow1],
      [2, "Thread two", "Setting the right price", I.sow2],
    ]);
    expect(onBoard.canPin).toBe(false);
    expect(onBoard.choices).toEqual([]);
    // Pereira is in the workspace but not on Marrowfield: the database's read rule returns nothing.
    expect(titles(await list(P.pereira))).toEqual([]);
    expect(titles(await list(P.quinn))).toEqual(["Thread one", "Thread two"]);
    expect(await list(P.coach)).toBe(403);
    expect(await list(P.guest)).toBe(403);
  });

  it("reads as a member with that member's own client and named columns only", async () => {
    await pin(P.hollis, B.t1);
    world.log.length = 0;
    await list(P.yilmaz);
    const reads = world.log.filter((entry) => entry.table === "board_reading_pins");
    expect(reads).toEqual([{ client: "user", table: "board_reading_pins", op: "select", columns: "thread_id, slot" }]);
  });

  it("drops a pin the moment its thread stops being shared, and brings it back when sharing returns", async () => {
    await pin(P.hollis, B.t1);
    await pin(P.hollis, B.t2);
    const thread = world.engagements.find((entry) => entry.id === B.t1)!;

    thread.shared_with_firm = false;
    for (const who of [P.yilmaz, P.quinn, P.hollis]) expect(titles(await list(who))).toEqual(["Thread two"]);
    // Hidden, not deleted: the row is kept (the founder's choice), and it is not offered again while unshared.
    expect(world.board_reading_pins).toHaveLength(2);
    expect(((await list(P.hollis)) as ReadingList).choices.map((entry) => entry.threadId)).not.toContain(B.t1);

    thread.shared_with_firm = true;
    for (const who of [P.yilmaz, P.quinn, P.hollis]) expect(titles(await list(who))).toEqual(["Thread one", "Thread two"]);
  });

  it("hides an archived thread the same way", async () => {
    await pin(P.hollis, B.t1);
    world.engagements.find((entry) => entry.id === B.t1)!.archived_at = "2026-11-19T00:00:00Z";
    expect(titles(await list(P.yilmaz))).toEqual([]);
  });

  it("lets a hidden pin give way when the list would otherwise look open but refuse", async () => {
    for (const thread of [B.t1, B.t2, B.t3]) await pin(P.hollis, thread);
    world.engagements.find((entry) => entry.id === B.t2)!.shared_with_firm = false;
    const result = (await pin(P.hollis, B.t4)) as ReadingWrite;
    expect(result).toMatchObject({ ok: true });
    expect(world.board_reading_pins.map((row) => [row.slot, row.thread_id]).sort()).toEqual([
      [1, B.t1],
      [2, B.t4],
      [3, B.t3],
    ]);
  });

  it("offers only shared threads to add, never this board or one already pinned", async () => {
    await pin(P.hollis, B.t1);
    const view = (await list(P.hollis)) as ReadingList;
    expect(view.choices.map((entry) => entry.threadId)).toEqual([B.t4, B.t3, B.t2]);
    expect(view.canPin).toBe(true);
  });

  it("never says who pinned, and never selects that column", async () => {
    const written = await pin(P.hollis, B.t1);
    expect(world.board_reading_pins[0]!.pinned_by).toBe(P.hollis);
    for (const payload of [written, await list(P.yilmaz), await list(P.quinn), await list(P.hollis), await unpin(P.hollis, B.t1)]) {
      expect(namesAPerson(payload)).toBe(false);
    }
    const selects = world.log.filter((entry) => entry.op === "select" && (entry.table === "board_reading_pins" || entry.table === "firm_exemplars"));
    expect(selects.length).toBeGreaterThan(0);
    for (const entry of selects) expect(entry.columns).toMatch(/^(thread_id, slot|work_item_id, engagement_id)$/);
  });

  it("refuses ids that are not ids before anything is read", async () => {
    await expect(pin(P.hollis, "'; drop table engagements; --")).rejects.toThrow("Unknown engagement.");
    await expect(list(P.hollis, "<script>alert(1)</script>")).rejects.toThrow("Unknown board.");
    await expect(mark(P.hollis, "../../etc/passwd")).rejects.toThrow("Unknown work.");
    expect(world.log).toEqual([]);
  });
});

describe("the database's own rules, for a caller who goes around the server", () => {
  it("gives a member no pinned_by, no marked_by and no select star", async () => {
    await pin(P.hollis, B.t1);
    await mark(P.hollis, I.sow1);
    const yilmaz = fakeClient(world, "user", user(P.yilmaz));
    for (const columns of ["*", "thread_id, pinned_by", "pinned_by"]) {
      expect((await yilmaz.from("board_reading_pins").select(columns)).error?.code).toBe("42501");
    }
    for (const columns of ["*", "marked_by"]) expect((await yilmaz.from("firm_exemplars").select(columns)).error?.code).toBe("42501");
    expect((await yilmaz.from("board_reading_pins").select("id, org_id, board_id, thread_id, slot, created_at")).data).toHaveLength(1);
  });

  it("returns what the rules allow to each person reading the tables directly", async () => {
    await pin(P.hollis, B.t1);
    await mark(P.hollis, I.sow1);
    const pinsFor = async (who: string) => (await fakeClient(world, "user", user(who)).from("board_reading_pins").select("thread_id")).data?.length;
    const marksFor = async (who: string) => (await fakeClient(world, "user", user(who)).from("firm_exemplars").select("work_item_id")).data?.length;
    expect(await pinsFor(P.yilmaz)).toBe(1);
    expect(await pinsFor(P.quinn)).toBe(1);
    expect(await pinsFor(P.pereira)).toBe(0);
    for (const who of [P.guest, P.coach, P.outsider, P.gone]) expect(await pinsFor(who)).toBe(0);
    for (const who of [P.yilmaz, P.pereira, P.quinn]) expect(await marksFor(who)).toBe(1);
    for (const who of [P.guest, P.coach, P.outsider, P.gone]) expect(await marksFor(who)).toBe(0);
  });

  it("lets no member write either table, not even an admin", async () => {
    const hollis = fakeClient(world, "user", user(P.hollis));
    expect((await hollis.from("board_reading_pins").insert({ org_id: KESTREL, board_id: B.board, thread_id: B.t1, slot: 1 })).error?.code).toBe("42501");
    expect((await hollis.from("firm_exemplars").insert({ org_id: KESTREL, engagement_id: B.t1, work_item_id: I.sow1 })).error?.code).toBe("42501");
    expect((await hollis.from("board_reading_pins").delete().eq("board_id", B.board)).error?.code).toBe("42501");
    expect((await hollis.from("board_reading_pins").update({ slot: 2 }).eq("board_id", B.board)).error?.code).toBe("42501");
  });

  it("holds the limit of three and the shared-only rule even for the service role", async () => {
    const admin = fakeClient(world, "admin");
    const row = (thread: string, slot: number) => ({ org_id: KESTREL, board_id: B.board, thread_id: thread, slot });
    expect((await admin.from("board_reading_pins").insert(row(B.t1, 4))).error?.code).toBe("23514");
    expect((await admin.from("board_reading_pins").insert(row(B.unshared, 1))).error?.message).toMatch(/shared with the firm/);
    expect((await admin.from("board_reading_pins").insert(row(B.t1, 1))).error).toBeNull();
    expect((await admin.from("board_reading_pins").insert(row(B.t2, 1))).error?.code).toBe("23505");
  });
});

describe("the exemplar mark", () => {
  it("is set and removed by admins and leads only", async () => {
    expect(await mark(P.hollis, I.sow1)).toEqual({ ok: true, exemplar: true });
    expect(await mark(P.lee, I.sow2)).toEqual({ ok: true, exemplar: true });
    for (const who of [P.quinn, P.yilmaz, P.pereira, P.coach, P.guest, P.gone]) {
      expect(await mark(who, I.sow3)).toBe(403);
      expect(await unmark(who, I.sow1)).toBe(403);
    }
    expect(world.firm_exemplars.map((row) => row.work_item_id).sort()).toEqual([I.sow1, I.sow2]);
    expect(await unmark(P.lee, I.sow1)).toEqual({ ok: true, exemplar: false });
    expect(world.firm_exemplars.map((row) => row.work_item_id)).toEqual([I.sow2]);
  });

  it.each([
    ["work on an unshared board", I.secret],
    ["a private item on a shared board", I.private1],
    ["a guest's file", I.guest1],
    ["work on the admin's own unshared board", I.onBoard],
    ["another workspace's work", I.elsewhere],
    ["work that does not exist", id(998)],
  ])("refuses %s in plain words and writes nothing", async (_what, itemId) => {
    expect(await mark(P.hollis, itemId)).toEqual({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared });
    expect(await unmark(P.hollis, itemId)).toEqual({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared });
    expect(world.firm_exemplars).toEqual([]);
  });

  it("writes the board the firm reader places the item on, and refuses any other board", async () => {
    expect(await mark(P.hollis, I.sow1, B.t2)).toEqual({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared });
    expect(await mark(P.hollis, I.sow1, B.t1)).toEqual({ ok: true, exemplar: true });
    expect(world.firm_exemplars).toMatchObject([{ org_id: KESTREL, engagement_id: B.t1, work_item_id: I.sow1, marked_by: P.hollis }]);
  });

  it("another workspace's admin cannot mark our work, and marks only their own", async () => {
    expect(await mark(P.outsider, I.sow1)).toEqual({ ok: false, refusal: EXEMPLAR_COPY.refusedNotShared });
    expect(await mark(P.outsider, I.elsewhere)).toEqual({ ok: true, exemplar: true });
    expect(world.firm_exemplars).toMatchObject([{ org_id: OTHER, work_item_id: I.elsewhere }]);
  });

  it("changes nothing when marked twice, even at once", async () => {
    const ctx = await contextFor(P.hollis);
    expect(await Promise.all([markExemplar(ctx, { itemId: I.sow1 }), markExemplar(ctx, { itemId: I.sow1 })])).toEqual([
      { ok: true, exemplar: true },
      { ok: true, exemplar: true },
    ]);
    expect(await mark(P.lee, I.sow1)).toEqual({ ok: true, exemplar: true });
    expect(world.firm_exemplars).toHaveLength(1);
  });

  it("reaches readers as a yes or no on work already in their corpus, and never as a name", async () => {
    await mark(P.hollis, I.sow1);
    const member = await requireFirmMember(fakeClient(world, "user", user(P.yilmaz)) as never, user(P.yilmaz), P.yilmaz);
    const corpus = await readFirmCorpus(member.supabaseAdmin, member.profile);
    expect(corpus.items.filter((entry) => entry.exemplar).map((entry) => entry.id)).toEqual([I.sow1]);
    expect(corpus.items.find((entry) => entry.id === I.sow2)).not.toHaveProperty("exemplar");
    expect(JSON.stringify(corpus.items)).not.toContain(P.hollis);
    const reads = world.log.filter((entry) => entry.table === "firm_exemplars" && entry.op === "select");
    expect(reads.length).toBeGreaterThan(0);
    for (const entry of reads) expect(entry).toMatchObject({ client: "admin", columns: "work_item_id, engagement_id" });
  });

  it("is hidden while the board is unshared and returns when it is shared again", async () => {
    await mark(P.hollis, I.sow1);
    const corpusFor = async () => {
      const member = await requireFirmMember(fakeClient(world, "user", user(P.yilmaz)) as never, user(P.yilmaz), P.yilmaz);
      return readFirmCorpus(member.supabaseAdmin, member.profile);
    };
    const thread = world.engagements.find((entry) => entry.id === B.t1)!;
    thread.shared_with_firm = false;
    expect((await corpusFor()).items.some((entry) => entry.id === I.sow1)).toBe(false);
    expect((await fakeClient(world, "user", user(P.yilmaz)).from("firm_exemplars").select("work_item_id")).data).toEqual([]);
    expect(world.firm_exemplars).toHaveLength(1);
    thread.shared_with_firm = true;
    expect((await corpusFor()).items.find((entry) => entry.id === I.sow1)?.exemplar).toBe(true);
  });

  it("keeps the firm reader working if the marks cannot be read", async () => {
    const admin = fakeClient(world, "admin");
    const broken = { ...admin, from: (table: string) => (table === "firm_exemplars" ? { select: () => ({ eq: () => ({ in: async () => ({ data: null, error: { message: "relation does not exist" } }) }) }) } : admin.from(table)) };
    const corpus = await readFirmCorpus(broken as never, { id: P.yilmaz, org_id: KESTREL, role: "em" });
    expect(corpus.items.length).toBeGreaterThan(0);
    expect(corpus.items.some((entry) => entry.exemplar)).toBe(false);
  });
});

describe("what people ask the firm", () => {
  const asked = (count: number, dims: Record<string, string>, over: Partial<World["events"][number]> = {}) => {
    for (let n = 0; n < count; n += 1) {
      world.events.push({ org_id: KESTREL, event_type: "firm_ask.asked", environment: "production", ts: "2026-11-01T00:00:00Z", actor_hash: `hash-${dims["topic"] ?? dims["starter"]}-${n}`, profile_id: null, dims, ...over });
    }
  };
  const kinds = (who: string) => call(validateProfileInput, commonQuestionKindsCall, who, {});

  it("is for admins and leads; everyone else is refused", async () => {
    asked(5, { topic: "situation_pricing", starter: "none" });
    expect(await kinds(P.hollis)).toEqual([{ label: "Setting the right price", band: "5 to 9 people" }]);
    expect(await kinds(P.lee)).toHaveLength(1);
    for (const who of [P.quinn, P.yilmaz, P.pereira, P.coach, P.guest, P.gone]) expect(await kinds(who)).toBe(403);
  });

  it("shows nothing asked by fewer than five people, and a band from five", async () => {
    asked(4, { topic: "situation_pricing", starter: "none" });
    expect(await kinds(P.hollis)).toEqual([]);
    asked(1, { topic: "situation_pricing", starter: "none" }, { actor_hash: "a-fifth-person" });
    expect(await kinds(P.hollis)).toEqual([{ label: "Setting the right price", band: "5 to 9 people" }]);
  });

  it("counts people, not questions: one person asking fifty times is one", async () => {
    asked(50, { topic: "method_survey", starter: "none" }, { actor_hash: "one-person" });
    expect(await kinds(P.hollis)).toEqual([]);
  });

  it("uses bands, the chips' own labels, and leaves out typed questions that matched nothing", async () => {
    asked(12, { topic: "none", starter: "went_wrong" });
    asked(30, { topic: "method_survey", starter: "none" });
    asked(9, { topic: "none", starter: "none" });
    const lines = (await kinds(P.hollis)) as { label: string; band: string }[];
    expect(lines).toEqual(
      expect.arrayContaining([
        { label: "What went wrong last time", band: "10 to 24 people" },
        { label: "Survey", band: "25 or more people" },
      ]),
    );
    expect(lines).toHaveLength(2);
  });

  it("returns a label and a band and nothing else: no name, no count, no hash", async () => {
    asked(7, { topic: "situation_talent", starter: "similar" });
    const lines = (await kinds(P.hollis)) as Record<string, unknown>[];
    for (const line of lines) expect(Object.keys(line).sort()).toEqual(["band", "label"]);
    expect(JSON.stringify(lines)).not.toMatch(/hash|\b7\b|profile|actor/);
    expect(namesAPerson(lines)).toBe(false);
  });

  it("asks the database as the caller, never as the service role, and only for the caller's own workspace", async () => {
    asked(6, { topic: "situation_pricing", starter: "none" });
    world.log.length = 0;
    await kinds(P.hollis);
    expect(world.log.filter((entry) => entry.op === "rpc")).toEqual([{ client: "user", table: "rpc:firm_common_question_kinds", op: "rpc", columns: null }]);
    // The service role has no signed-in user, so the function gives it nothing.
    expect((await fakeClient(world, "admin").rpc("firm_common_question_kinds", { p_org: KESTREL })).data).toEqual([]);
    // Another workspace's admin sees only their own firm, whatever they send.
    expect(await call(validateProfileInput, commonQuestionKindsCall, P.outsider, { org_id: KESTREL, p_org: KESTREL })).toEqual([]);
    expect(validateProfileInput({ profile_id: P.outsider, org_id: KESTREL, p_org: KESTREL } as never)).toEqual({ profile_id: P.outsider });
    expect((await fakeClient(world, "user", user(P.outsider)).rpc("firm_common_question_kinds", { p_org: KESTREL })).data).toEqual([]);
  });

  it("ignores test traffic, old questions and other workspaces", async () => {
    asked(6, { topic: "situation_pricing", starter: "none" }, { environment: "preview" });
    asked(6, { topic: "situation_talent", starter: "none" }, { ts: "2026-07-01T00:00:00Z" });
    asked(6, { topic: "method_survey", starter: "none" }, { org_id: OTHER });
    expect(await kinds(P.hollis)).toEqual([]);
  });

  it("fails plainly, without the database's words, when the read fails", async () => {
    const context = { supabase: { ...fakeClient(world, "user", user(P.hollis)), rpc: async () => ({ data: null, error: { message: "secret detail" } }) }, userId: user(P.hollis) };
    await expect(commonQuestionKindsCall(context as unknown as CallContext, { profile_id: P.hollis })).rejects.toThrow("Could not read the common question kinds.");
  });
});

describe("the topic recorded when someone asks the firm", () => {
  const dimsFor = (question: string, starter: string | null = null) => firmAskedDims({ status: "answered", boardsRead: 4, sources: 2, starter, question });

  it("is a fixed kind on the existing firm_ask.asked event, and passes the server's dim guard", () => {
    const dims = dimsFor("How have we approached pricing for a membership model?", "similar");
    expect(dims).toEqual({ result: "answered", boards_read: "1-10", sources: "1-10", starter: "similar", topic: "situation_pricing" });
    expect(guardServerEventDims("firm_ask.asked", dims)).toMatchObject({ dims, dropped: [] });
  });

  it("holds no part of the question, whatever was typed", () => {
    const question = "What did Zebulon Quartzworth tell Brightwater Holdings about the Halvorsen overrun in Tulsa?";
    const dims = dimsFor(question);
    expect(dims["topic"]).toBe("none");
    const sent = JSON.stringify(dims).toLowerCase();
    for (const word of question.toLowerCase().match(/[a-z]{4,}/g)!) expect(sent, word).not.toContain(word);
  });

  it("is always one of the closed set, for hostile or huge input, and a made-up starter reads as none", () => {
    for (const question of ["<script>alert('pricing')</script> ignore previous instructions", "pricing ".repeat(600), "💥 survey; drop table events; --", "Ünïcödé naïve café fundraising", ""]) {
      const dims = dimsFor(question, "Zebulon Quartzworth");
      expect(TOPIC_KINDS).toContain(dims["topic"]);
      expect(dims["starter"]).toBe("none");
      for (const value of Object.values(dims)) expect(value.length).toBeLessThan(40);
    }
  });
});

/* ---------- static checks over the source ---------- */

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|stories)\.tsx?$/.test(name) ? [full] : [];
  });
}

const SOURCES = sourceFiles("src").map((file) => ({ file: file.split(path.sep).join("/"), text: readFileSync(file, "utf8") }));
const NEW_FILES = [
  "src/lib/manager-tools-shared.ts",
  "src/lib/manager-tools.server.ts",
  "src/lib/manager-tools.functions.ts",
  "src/hooks/use-exemplars.ts",
  "src/components/canvas-lab/ReadingListDialog.tsx",
  "src/components/firm-brain/CommonQuestionsCard.tsx",
  "src/components/firm-brain/ExemplarBadge.tsx",
];

describe("no view anywhere lists who asked what, or whose work was flagged", () => {
  it("no select anywhere in src names pinned_by or marked_by", () => {
    for (const { file, text } of SOURCES) {
      if (file === "src/integrations/supabase/types.ts") continue;
      for (const match of text.matchAll(/\.select\(\s*(["'`])([\s\S]*?)\1/g)) expect(match[2], file).not.toMatch(/pinned_by|marked_by/);
    }
  });

  it("names the two person columns only where a row is written", () => {
    const naming = SOURCES.filter(({ file, text }) => file !== "src/integrations/supabase/types.ts" && /pinned_by|marked_by/.test(text)).map(({ file }) => file);
    // The demo seed writes client_showings.marked_by; the manager tools write both columns on insert.
    expect(naming.sort()).toEqual(["src/lib/demo-firm/seed.server.ts", "src/lib/manager-tools.server.ts"]);
    const server = SOURCES.find(({ file }) => file === "src/lib/manager-tools.server.ts")!.text;
    for (const line of server.split("\n").filter((entry) => /pinned_by|marked_by/.test(entry))) expect(line).toMatch(/(pinned_by|marked_by): profile\.id/);
  });

  it("never selects everything from either table, and reads them only in the files that should", () => {
    const readers = SOURCES.filter(({ file, text }) => file !== "src/integrations/supabase/types.ts" && /from\("(board_reading_pins|firm_exemplars)"\)/.test(text));
    expect(readers.map(({ file }) => file).sort()).toEqual(["src/hooks/use-exemplars.ts", "src/lib/firm-corpus.server.ts", "src/lib/manager-tools.server.ts"]);
    for (const { file, text } of readers) {
      for (const match of text.matchAll(/from\("(?:board_reading_pins|firm_exemplars)"\)\s*\.select\(([^)]*)\)/g)) {
        expect(match[1], file).not.toMatch(/\*|^\s*$/);
      }
    }
  });

  it("no new file reads the events table, an asker's hash or an event's profile", () => {
    for (const name of NEW_FILES) {
      const text = SOURCES.find(({ file }) => file === name)?.text;
      expect(text, name).toBeDefined();
      expect(text, name).not.toMatch(/from\("events"\)|actor_hash|tenant_hash|ai_usage/);
    }
    const shared = SOURCES.find(({ file }) => file === "src/lib/manager-tools-shared.ts")!.text;
    // The only person field the shared rules know is the caller's own profile id, on the way in.
    expect(shared).not.toMatch(/display_name|owner_id|pinned_by|marked_by|user_id/);
    const payloads = shared.slice(shared.indexOf("export type ReadingPin"), shared.indexOf("export type ReadingWrite")) + shared.slice(shared.indexOf("export type CommonQuestion"), shared.indexOf("/**\n * Turns what the database function returned"));
    // Field names of everything a reading list or the common questions card can carry (the two words are from comments).
    const fields = [...payloads.matchAll(/\b(\w+)\??: /g)].map((match) => match[1]).filter((name) => !["appears", "added"].includes(name!));
    expect(fields.sort()).toEqual(["band", "canPin", "choices", "client", "client", "full", "label", "pins", "situation", "slot", "sourceItemId", "threadId", "threadId", "title", "title"]);
  });

  it("only the files that already did read events, and none sends a hash or profile id to a browser", () => {
    const readers = SOURCES.filter(({ text }) => /from\("events"\)/.test(text)).map(({ file }) => file);
    expect(readers.sort()).toEqual(["src/lib/data-consent.functions.ts", "src/lib/egress.server.ts", "src/lib/firm-dashboard.server.ts", "src/lib/telemetry.server.ts"]);
    // Client code (components, hooks, pages, routes) never names an asker's hash.
    for (const { file, text } of SOURCES) {
      if (/^src\/(components|hooks|pages|routes)\//.test(file)) expect(text, file).not.toMatch(/actor_hash/);
    }
  });

  it("the question's words reach the model call and nothing else in the ask function", () => {
    const ask = SOURCES.find(({ file }) => file === "src/lib/firm-ask.functions.ts")!.text;
    const handler = ask.slice(ask.indexOf("export const askTheFirm"), ask.indexOf("export type FirmSourcePreview"));
    expect(handler.match(/data\.question/g)).toHaveLength(2);
    expect(handler).toContain("question: data.question, canSeeFees");
    // The event's dims are built by firmAskedDims and nothing else, which returns only buckets and fixed kinds.
    expect(handler).toMatch(/dims: firmAskedDims\(\{[^}]*question: data\.question,\s*\}\),/);
    expect(handler).not.toMatch(/console\.|logHealth|payload:/);
  });

  it("every manager tool is behind sign-in and the firm member gate", () => {
    const functions = SOURCES.find(({ file }) => file === "src/lib/manager-tools.functions.ts")!.text;
    const exported = functions.match(/export const \w+Fn = createServerFn/g) ?? [];
    expect(exported).toHaveLength(6);
    expect(functions.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(6);
    // Each handler does one thing: hand the validated input to its call in the server file (tested above).
    expect(functions.match(/\.handler\(async \(\{ data, context \}\)[^\n]*\(await import\("\.\/manager-tools\.server"\)\)\.\w+Call\(context, data\)\);/g)).toHaveLength(6);
    const server = SOURCES.find(({ file }) => file === "src/lib/manager-tools.server.ts")!.text;
    const calls = server.slice(server.indexOf("the calls the server functions make"));
    expect(calls.match(/export async function \w+Call/g)).toHaveLength(6);
    expect(calls.match(/await gate\(context, data\.profile_id\)|await requireFirmMember\(context\.supabase, context\.userId, data\.profile_id\)/g)).toHaveLength(6);
    expect(server).not.toMatch(/admin\.rpc|supabaseAdmin\.rpc/);
  });
});

describe("the two applied migrations, as recorded in the repo", () => {
  const pins = readFileSync("supabase/migrations/20261119100000_s8_reading_pins_and_exemplars.sql", "utf8");
  const kinds = readFileSync("supabase/migrations/20261119110000_s8_common_question_kinds.sql", "utf8");

  it("turns on row security, grants members named columns only, and gives them no write", () => {
    expect(pins).toContain("alter table public.board_reading_pins enable row level security");
    expect(pins).toContain("alter table public.firm_exemplars enable row level security");
    expect(pins).toContain("grant select (id, org_id, board_id, thread_id, slot, created_at) on public.board_reading_pins to authenticated");
    expect(pins).toContain("grant select (id, org_id, engagement_id, work_item_id, created_at) on public.firm_exemplars to authenticated");
    expect(pins).toContain("revoke all on table public.board_reading_pins from anon, authenticated");
    expect(pins).toContain("revoke all on table public.firm_exemplars from anon, authenticated");
    expect(pins).not.toMatch(/for (insert|update|delete|all) to/);
    expect(pins.match(/create policy/g)).toHaveLength(2);
  });

  it("limits a list to three and to shared threads, and adds nothing to engagements", () => {
    expect(pins).toContain("slot smallint not null check (slot between 1 and 3)");
    expect(pins).toContain("unique (board_id, slot)");
    expect(pins).toContain("only a thread shared with the firm can be pinned");
    // The founder's choice: hidden while unshared, back when shared again. No cleanup trigger.
    expect(pins).not.toMatch(/unshare_cleanup|on public\.engagements/);
  });

  it("returns kinds and bands only, for admins and leads, from five people up", () => {
    expect(kinds).toContain("returns table (question_source text, question_kind text, askers_band text)");
    expect(kinds).toContain("having count(distinct a.actor_hash) >= 5");
    expect(kinds).toContain("public.firm_role_in(p_org) in ('admin', 'lead')");
    expect(kinds).toContain("interval '90 days'");
    expect(kinds.slice(kinds.lastIndexOf("select c.src"))).not.toMatch(/actor_hash|profile_id|askers,/);
    expect(kinds).toContain("revoke all on function public.firm_common_question_kinds(uuid) from public");
  });

  it("holds no em dash", () => {
    for (const text of [pins, kinds]) expect(text).not.toContain("\u2014");
  });
});
