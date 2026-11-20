// 20 Nov 2026, chat pill build Phase 2: who can be invited as what, and the role change rules on the server.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { ROLE_NOT_OFFERED_LINE } from "@/lib/invites-shared";
import { invitableRoles, MEMBER_ROLE_LABELS, ROLE_COPY, roleChangeRefusal, type RoleChangeCase } from "@/lib/member-roles-shared";
import { changeMemberRole, type RoleChangeDeps } from "@/lib/members.server";
import { ROLE_LABELS } from "@/hooks/use-profile";

const company = { firmView: true, showsAdmin: true };
const partner = { firmView: false, showsAdmin: true };
const personal = { firmView: false, showsAdmin: false };

describe("the four roles", () => {
  it("are Admin, Lead, Member and Coach everywhere they are named", () => {
    expect(MEMBER_ROLE_LABELS).toEqual({ admin: "Admin", lead: "Lead", em: "Member", coach: "Coach" });
    expect(ROLE_LABELS["em"]).toBe("Member");
    expect(JSON.stringify(ROLE_COPY)).not.toMatch(/—|Engagement Mgr/);
  });

  it("offer Lead only in company workspaces and Admin only in business ones", () => {
    expect(invitableRoles(company)).toEqual(["em", "lead", "admin", "coach"]);
    expect(invitableRoles(partner)).toEqual(["em", "admin", "coach"]);
    expect(invitableRoles(personal)).toEqual(["em", "coach"]);
  });

  it("the invite server refuses a role the workspace does not offer, before minting", () => {
    const fn = readFileSync("src/lib/invites.functions.ts", "utf8");
    const check = fn.indexOf("invitableRoles(");
    expect(check).toBeGreaterThan(0);
    expect(check).toBeLessThan(fn.indexOf('rpc("make_invite"'));
    expect(fn).toContain("ROLE_NOT_OFFERED_LINE");
    expect(ROLE_NOT_OFFERED_LINE).not.toMatch(/—/);
  });
});

const base = (over: Partial<RoleChangeCase> = {}): RoleChangeCase => ({
  caller: { profileId: "me", orgId: "org", role: "admin", active: true },
  target: { id: "t", orgId: "org", role: "em", active: true, isGuest: false },
  next: "lead",
  workspace: company,
  activeAdmins: 2,
  ...over,
});

describe("roleChangeRefusal", () => {
  it("lets an admin make a Member a Lead or an Admin, and a Lead a Member", () => {
    expect(roleChangeRefusal(base())).toBeNull();
    expect(roleChangeRefusal(base({ next: "admin" }))).toBeNull();
    expect(roleChangeRefusal(base({ target: { id: "t", orgId: "org", role: "lead", active: true, isGuest: false }, next: "em" }))).toBeNull();
  });
  it.each([
    ["a lead caller", { caller: { profileId: "me", orgId: "org", role: "lead", active: true } }, "not_admin"],
    ["a member caller", { caller: { profileId: "me", orgId: "org", role: "em", active: true } }, "not_admin"],
    ["a coach caller", { caller: { profileId: "me", orgId: "org", role: "coach", active: true } }, "not_admin"],
    ["a deactivated admin", { caller: { profileId: "me", orgId: "org", role: "admin", active: false } }, "not_admin"],
    ["someone in another workspace", { target: { id: "t", orgId: "other", role: "em", active: true, isGuest: false } }, "not_found"],
    ["nobody", { target: null }, "not_found"],
    ["your own role", { target: { id: "me", orgId: "org", role: "admin", active: true, isGuest: false }, next: "em" }, "self"],
    ["a deactivated person", { target: { id: "t", orgId: "org", role: "em", active: false, isGuest: false } }, "inactive"],
    ["a guest", { target: { id: "t", orgId: "org", role: "em", active: true, isGuest: true } }, "guest"],
    ["a coach", { target: { id: "t", orgId: "org", role: "coach", active: true, isGuest: false } }, "coach"],
    ["making someone a coach", { next: "coach" }, "coach"],
    ["an unknown role", { next: "owner" }, "role"],
    ["no role", { next: undefined }, "role"],
    ["Lead outside a company workspace", { workspace: partner }, "lead_needs_firm"],
    ["Admin where the workspace shows no admins", { workspace: personal, next: "admin" }, "role"],
    ["the role they have", { next: "em" }, "same"],
    ["the last admin", { target: { id: "t", orgId: "org", role: "admin", active: true, isGuest: false }, next: "em", activeAdmins: 1 }, "last_admin"],
  ])("refuses %s", (_label, over, reason) => {
    expect(roleChangeRefusal(base(over as Partial<RoleChangeCase>))).toBe(reason);
  });
  it("has a plain line for every refusal", () => {
    for (const line of Object.values(ROLE_COPY.refusals)) expect(line.length).toBeGreaterThan(10);
  });
});

function deps(over: Partial<RoleChangeDeps> = {}) {
  const rows = new Map([
    ["me", { id: "me", orgId: "org", role: "admin", active: true, isGuest: false }],
    ["t", { id: "t", orgId: "org", role: "em", active: true, isGuest: false }],
    ["a2", { id: "a2", orgId: "org", role: "admin", active: true, isGuest: false }],
  ]);
  const d: RoleChangeDeps & { rows: typeof rows } = {
    rows,
    caller: vi.fn(async () => ({ profileId: "me", orgId: "org", role: "admin", active: true })),
    target: vi.fn(async (orgId: string, id: string) => {
      const row = rows.get(id);
      return row && row.orgId === orgId ? { ...row } : null;
    }),
    workspace: vi.fn(async () => company),
    activeAdmins: vi.fn(async () => [...rows.values()].filter((r) => r.role === "admin" && r.active).length),
    write: vi.fn(async (_orgId: string, id: string, from: string, to: string) => {
      const row = rows.get(id);
      if (!row || row.role !== from) return false;
      row.role = to;
      return true;
    }),
    record: vi.fn(async () => undefined),
    ...over,
  };
  return d;
}

describe("changeMemberRole", () => {
  it("makes a Member a Lead and records only the two role names", async () => {
    const d = deps();
    expect(await changeMemberRole(d, { member_id: "t", role: "lead" })).toEqual({ ok: true, role: "lead" });
    expect(d.rows.get("t")!.role).toBe("lead");
    expect(d.record).toHaveBeenCalledWith("org", "em", "lead");
    expect(EVENT_DIM_KEYS["member.role_changed"]).toEqual(["from", "to"]);
  });

  it("refuses with 403 when there is no caller", async () => {
    const d = deps({ caller: vi.fn(async () => null) });
    await expect(changeMemberRole(d, { member_id: "t", role: "lead" })).rejects.toMatchObject({ status: 403 });
    expect(d.write).not.toHaveBeenCalled();
  });

  it("never writes on a refusal (your own role, a lead caller)", async () => {
    const own = deps();
    expect(await changeMemberRole(own, { member_id: "me", role: "em" })).toEqual({ ok: false, reason: "self" });
    const lead = deps({ caller: vi.fn(async () => ({ profileId: "x", orgId: "org", role: "lead", active: true })) });
    expect(await changeMemberRole(lead, { member_id: "t", role: "admin" })).toEqual({ ok: false, reason: "not_admin" });
    expect(own.write).not.toHaveBeenCalled();
    expect(lead.write).not.toHaveBeenCalled();
  });

  it("cannot demote the last admin", async () => {
    const d = deps();
    d.rows.delete("a2");
    d.rows.set("t", { id: "t", orgId: "org", role: "admin", active: true, isGuest: false });
    d.rows.get("me")!.role = "lead";
    const asAdmin = deps({ caller: vi.fn(async () => ({ profileId: "me", orgId: "org", role: "admin", active: true })), activeAdmins: vi.fn(async () => 1), target: d.target });
    expect(await changeMemberRole(asAdmin, { member_id: "t", role: "em" })).toEqual({ ok: false, reason: "last_admin" });
    expect(asAdmin.write).not.toHaveBeenCalled();
  });

  it("puts an admin back when two admins demoted each other at once and none is left", async () => {
    const d = deps();
    let reads = 0;
    // Two admins counted before the write; the other admin was demoted meanwhile, so none after.
    d.activeAdmins = vi.fn(async () => (reads++ === 0 ? 2 : 0));
    expect(await changeMemberRole(d, { member_id: "a2", role: "em" })).toEqual({ ok: false, reason: "last_admin" });
    expect(d.rows.get("a2")!.role).toBe("admin");
    expect(d.record).not.toHaveBeenCalled();
  });

  it("says no admin may be left when even the put-back fails, never that the admin is still there (QA L1)", async () => {
    const d = deps();
    let reads = 0;
    d.activeAdmins = vi.fn(async () => (reads++ === 0 ? 2 : 0));
    const write = d.write;
    let calls = 0;
    d.write = vi.fn(async (...a: Parameters<RoleChangeDeps["write"]>) => (calls++ === 0 ? write(...a) : false));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await changeMemberRole(d, { member_id: "a2", role: "em" })).toEqual({ ok: false, reason: "no_admin_left" });
    expect(JSON.stringify(error.mock.calls)).not.toMatch(/a2|me@/);
    error.mockRestore();
  });

  it("does not overwrite a change someone else made meanwhile", async () => {
    const d = deps({ write: vi.fn(async () => false) });
    expect(await changeMemberRole(d, { member_id: "t", role: "lead" })).toEqual({ ok: false, reason: "unavailable" });
    expect(d.record).not.toHaveBeenCalled();
  });

  it("fails closed when a read fails, and a failed record still counts as done", async () => {
    expect(await changeMemberRole(deps({ activeAdmins: vi.fn(async () => null) }), { member_id: "t", role: "lead" })).toEqual({ ok: false, reason: "unavailable" });
    expect(await changeMemberRole(deps({ workspace: vi.fn(async () => null) }), { member_id: "t", role: "lead" })).toEqual({ ok: false, reason: "unavailable" });
    expect(await changeMemberRole(deps({ target: vi.fn(async () => Promise.reject(new Error("x"))) }), { member_id: "t", role: "lead" })).toEqual({ ok: false, reason: "unavailable" });
    expect(await changeMemberRole(deps({ record: vi.fn(async () => Promise.reject(new Error("y"))) }), { member_id: "t", role: "lead" })).toEqual({ ok: true, role: "lead" });
  });

  it("refuses Lead in a workspace without proposals", async () => {
    expect(await changeMemberRole(deps({ workspace: vi.fn(async () => partner) }), { member_id: "t", role: "lead" })).toEqual({ ok: false, reason: "lead_needs_firm" });
  });
});
