// 19 Nov, Kestrel Bay demo story: the server check. Only an active member of the demo firm's workspace is allowed;
// a person from another workspace, a guest, a coach, a deactivated person and a failed read all get "not allowed".
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ resolve: vi.fn() }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: (...a: unknown[]) => m.resolve(...a) }));

import { KESTREL_BAY_ORG_ID } from "../firm-story-shared";
import { firmStoryAccessCall } from "../firm-story.server";

function db(row: unknown, error: unknown = null) {
  const calls: string[] = [];
  const chain = {
    select: (columns: string) => { calls.push(`select:${columns}`); return chain; },
    eq: () => chain,
    maybeSingle: async () => ({ data: row, error }),
  };
  return { calls, client: { from: (table: string) => { calls.push(`from:${table}`); return chain; } } };
}

type Ctx = Parameters<typeof firmStoryAccessCall>[0];
const ctx = (client: unknown): Ctx => ({ supabase: client as Ctx["supabase"], userId: "u1" });

describe("firmStoryAccessCall", () => {
  beforeEach(() => m.resolve.mockReset());

  it("asks for the caller's profile in the demo firm's workspace only", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role: "lead" });
    const { client } = db({ is_guest: false, deactivated_at: null });
    await firmStoryAccessCall(ctx(client), { profile_id: "p1" });
    expect(m.resolve).toHaveBeenCalledWith(client, "u1", "p1", KESTREL_BAY_ORG_ID);
  });

  it("allows a lead as the Partner and a standard member as the Engagement lead", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role: "lead" });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: false, deactivated_at: null }).client), {})).toEqual({ allowed: true, window: "partner" });
    m.resolve.mockResolvedValue({ id: "p2", org_id: KESTREL_BAY_ORG_ID, role: "em" });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: false, deactivated_at: null }).client), {})).toEqual({ allowed: true, window: "lead" });
  });

  it("refuses a person with no profile in the demo firm, without reading anything else", async () => {
    m.resolve.mockResolvedValue(null);
    const { client, calls } = db({ is_guest: false, deactivated_at: null });
    expect(await firmStoryAccessCall(ctx(client), {})).toEqual({ allowed: false });
    expect(calls).toEqual([]);
  });

  it("refuses a guest, a coach, a deactivated person, a missing row and a failed read", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role: "em" });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: true, deactivated_at: null }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: false, deactivated_at: "2026-11-01" }).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db(null).client), {})).toEqual({ allowed: false });
    expect(await firmStoryAccessCall(ctx(db(null, { message: "boom" }).client), {})).toEqual({ allowed: false });
    m.resolve.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role: "coach" });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: false, deactivated_at: null }).client), {})).toEqual({ allowed: false });
  });

  it("refuses when the resolved profile is somehow in another workspace", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: "15db4d78-eed3-4443-b9ef-437a67ad1b79", role: "admin" });
    expect(await firmStoryAccessCall(ctx(db({ is_guest: false, deactivated_at: null }).client), {})).toEqual({ allowed: false });
  });

  it("reads only the two columns it needs and writes nothing", async () => {
    m.resolve.mockResolvedValue({ id: "p1", org_id: KESTREL_BAY_ORG_ID, role: "em" });
    const { client, calls } = db({ is_guest: false, deactivated_at: null });
    await firmStoryAccessCall(ctx(client), {});
    expect(calls).toEqual(["from:profiles", "select:is_guest, deactivated_at"]);
  });
});
