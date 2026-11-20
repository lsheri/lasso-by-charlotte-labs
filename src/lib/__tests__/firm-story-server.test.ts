// 19 Nov, Kestrel Bay demo story: the server check. Only an active member of the demo firm's workspace is allowed;
// a person from another workspace, a guest, a coach, a deactivated person and a failed read all get "not allowed".
// 20 Nov: the demo workspace is found by its settings marker, never by id, and the story board by its title there.
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: (...a: unknown[]) => m.resolve(...a) }));

import { DEMO_FIRM_MARKER, STORY_BOARD_TITLE } from "../firm-story-shared";
import { firmStoryAccessCall } from "../firm-story.server";
import { DEMO_FIRM_MARKER as SEED_MARKER } from "../demo-firm/seed.server";
import { DEMO_BOARDS } from "../demo-firm";

const DEMO = "any-demo-org";
const OTHER = "15db4d78-eed3-4443-b9ef-437a67ad1b79";
type Tables = { profiles?: unknown; orgs?: unknown; engagements?: unknown; error?: Partial<Record<string, unknown>> };

function db(tables: Tables) {
  const calls: string[] = [];
  const client = {
    from: (table: string) => {
      calls.push(`from:${table}`);
      const chain = {
        select: (columns: string) => (calls.push(`select:${columns}`), chain),
        eq: (key: string, value: unknown) => (calls.push(`eq:${key}=${String(value)}`), chain),
        is: () => chain,
        limit: () => chain,
        maybeSingle: async () => ({ data: (tables as Record<string, unknown>)[table] ?? null, error: tables.error?.[table] ?? null }),
      };
      return chain;
    },
  };
  return { calls, client };
}
const demoOrg = { settings: { type: "company", demo_firm: DEMO_FIRM_MARKER } };
const active = { is_guest: false, deactivated_at: null };

type Ctx = Parameters<typeof firmStoryAccessCall>[0];
const ctx = (client: unknown): Ctx => ({ supabase: client as Ctx["supabase"], userId: "u1" });

describe("firmStoryAccessCall", () => {
  beforeEach(() => m.resolve.mockReset());

  it("asks for the caller's own profile, not one pinned to a fixed workspace id", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: DEMO, role: "lead" });
    const { client } = db({ profiles: active, orgs: demoOrg });
    await firmStoryAccessCall(ctx(client), { profile_id: "p1" });
    expect(m.resolve).toHaveBeenCalledWith(client, "u1", "p1");
  });

  it("allows a lead as the Partner and a standard member as the Engagement lead, with the story board's id", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: DEMO, role: "lead" });
    expect(await firmStoryAccessCall(ctx(db({ profiles: active, orgs: demoOrg, engagements: { id: "board-1" } }).client), {})).toEqual({ allowed: true, window: "partner", boardId: "board-1" });
    m.resolve.mockResolvedValue({ id: "p2", org_id: DEMO, role: "em" });
    expect(await firmStoryAccessCall(ctx(db({ profiles: active, orgs: demoOrg }).client), {})).toEqual({ allowed: true, window: "lead", boardId: null });
  });

  it("finds the board by its title inside the caller's own workspace", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: DEMO, role: "admin" });
    const { client, calls } = db({ profiles: active, orgs: demoOrg, engagements: { id: "board-1" } });
    await firmStoryAccessCall(ctx(client), {});
    expect(calls).toContain(`eq:org_id=${DEMO}`);
    expect(calls).toContain(`eq:title=${STORY_BOARD_TITLE}`);
  });

  it("refuses a person with no profile, without reading anything else", async () => {
    m.resolve.mockResolvedValue(null);
    const { client, calls } = db({ profiles: active, orgs: demoOrg });
    expect(await firmStoryAccessCall(ctx(client), {})).toEqual({ allowed: false });
    expect(calls).toEqual([]);
  });

  it("refuses every workspace without the marker, and never reads a board there", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: OTHER, role: "admin" });
    for (const settings of [{ type: "company" }, { type: "company", demo_firm: "true" }, { type: "company", demo_firm: true }, null, ["kestrel-bay"]]) {
      const { client, calls } = db({ profiles: active, orgs: { settings }, engagements: { id: "board-1" } });
      expect(await firmStoryAccessCall(ctx(client), {})).toEqual({ allowed: false });
      expect(calls).not.toContain("from:engagements");
    }
  });

  it("refuses a guest, a coach, a deactivated person, a missing row and a failed read", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: DEMO, role: "em" });
    expect(await firmStoryAccessCall(ctx(db({ profiles: { is_guest: true, deactivated_at: null }, orgs: demoOrg }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db({ profiles: { is_guest: false, deactivated_at: "2026-11-01" }, orgs: demoOrg }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db({ orgs: demoOrg }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db({ profiles: active, orgs: demoOrg, error: { profiles: { message: "boom" } } }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db({ profiles: active, orgs: demoOrg, error: { orgs: { message: "boom" } } }).client), {})).toEqual({ allowed: false });
    m.resolve.mockResolvedValue({ id: "p1", org_id: DEMO, role: "coach" });
    expect(await firmStoryAccessCall(ctx(db({ profiles: active, orgs: demoOrg }).client), {})).toEqual({ allowed: false });
  });

  it("uses the same marker as the seed, and the board title is the seed's story board", () => {
    expect(DEMO_FIRM_MARKER).toBe(SEED_MARKER);
    expect(DEMO_BOARDS.find((board) => board.key === "b31")?.title).toBe(STORY_BOARD_TITLE);
  });
});
