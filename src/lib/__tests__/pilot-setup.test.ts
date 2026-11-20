// 20 Nov 2026, Set up a pilot: the shared rules, the founder gate and the server flow with plain dependencies.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { requireFounder } from "@/lib/founder-gate.server";
import { cleanPilotInput, PILOT_COPY, PILOT_INVITE_DAYS, sameFirmName } from "@/lib/pilot-setup-shared";
import { setUpPilot, type PilotDeps } from "@/lib/pilot-setup.server";

const NOW = new Date("2026-11-20T15:00:00.000Z");

function deps(over: Partial<PilotDeps> = {}) {
  const calls: string[] = [];
  const base: PilotDeps = {
    gate: vi.fn(async () => undefined),
    companyNames: vi.fn(async () => ["Kestrel Bay Advisory", "QA Firm"]),
    createOrg: vi.fn(async () => "org-new"),
    ensureClientsOn: vi.fn(async () => true),
    createInvite: vi.fn(async () => "abc123def456"),
    removeOrg: vi.fn(async () => {
      calls.push("removed");
      return true;
    }),
    sendInvite: vi.fn(async () => "sent" as const),
    joinUrl: (code) => `https://lasso.charlotte-labs.com/join?code=${code}`,
    record: vi.fn(async () => undefined),
  };
  return { d: { ...base, ...over }, calls };
}

const good = { firm_name: "  Alder   Row Partners ", admin_email: " Jo.Smith@AlderRow.com " };

describe("cleanPilotInput", () => {
  it("trims, collapses spaces and lower-cases the email", () => {
    expect(cleanPilotInput(good)).toEqual({ ok: true, value: { firmName: "Alder Row Partners", adminEmail: "jo.smith@alderrow.com" } });
  });
  it("keeps accented, hyphenated and short names", () => {
    expect(cleanPilotInput({ firm_name: "Sørensen-Ødegård & Co.", admin_email: "a@b.co" }).ok).toBe(true);
    expect(cleanPilotInput({ firm_name: "St. Brigid", admin_email: "a@b.co" }).ok).toBe(true);
  });
  it.each([
    [{ firm_name: "", admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: "A", admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: "x".repeat(81), admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: "<script>alert(1)</script>", admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: "Bad\u0007Bell", admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: 42, admin_email: "a@b.co" }, "firm_name"],
    [{ firm_name: "Alder Row", admin_email: "not an email" }, "admin_email"],
    [{ firm_name: "Alder Row", admin_email: "a@b" }, "admin_email"],
    [{ firm_name: "Alder Row", admin_email: "a@@b.co" }, "admin_email"],
    [null, "firm_name"],
  ])("refuses %j on %s", (input, field) => {
    expect(cleanPilotInput(input)).toEqual({ ok: false, field });
  });
  it("drops invisible and direction-changing characters, so a lookalike name matches the real one (QA L3)", () => {
    expect(cleanPilotInput({ firm_name: "Kestrel\u200bBay", admin_email: "a@b.co" })).toEqual({ ok: true, value: { firmName: "KestrelBay", adminEmail: "a@b.co" } });
    expect(cleanPilotInput({ firm_name: "Acme\u202eevil", admin_email: "a@b.co" })).toMatchObject({ ok: true, value: { firmName: "Acmeevil" } });
    expect(sameFirmName("Kestrel Bay", "Kestrel \u2060Bay\ufeff")).toBe(true);
    expect(cleanPilotInput({ firm_name: "\u200b\u200b", admin_email: "a@b.co" })).toEqual({ ok: false, field: "firm_name" });
  });
  it("matches names ignoring case, spacing and a trailing full stop", () => {
    expect(sameFirmName("Alder Row Partners.", "  alder  row partners")).toBe(true);
    expect(sameFirmName("Alder Row", "Alder Row Partners")).toBe(false);
  });
  it("has no em dashes in its copy", () => {
    expect(JSON.stringify(PILOT_COPY)).not.toMatch(/—/);
  });
});

describe("setUpPilot", () => {
  it("makes the workspace, turns clients on, invites the admin by email and records only whether it emailed", async () => {
    const { d } = deps();
    const result = await setUpPilot(d, good, NOW);
    expect(result).toEqual({
      ok: true,
      orgId: "org-new",
      orgName: "Alder Row Partners",
      joinUrl: "https://lasso.charlotte-labs.com/join?code=abc123def456",
      emailed: "sent",
    });
    expect(d.createOrg).toHaveBeenCalledWith("Alder Row Partners", NOW.toISOString());
    expect(d.ensureClientsOn).toHaveBeenCalledWith("org-new");
    const expires = new Date(NOW.getTime() + PILOT_INVITE_DAYS * 86_400_000).toISOString();
    expect(d.createInvite).toHaveBeenCalledWith("org-new", "jo.smith@alderrow.com", expires);
    expect(d.sendInvite).toHaveBeenCalledWith({ to: "jo.smith@alderrow.com", code: "abc123def456", orgName: "Alder Row Partners" });
    expect(d.record).toHaveBeenCalledWith("org-new", "sent");
  });

  it("runs the gate first: a refused caller makes nothing and reads nothing", async () => {
    const { d } = deps({ gate: vi.fn(async () => Promise.reject(new Response("Forbidden", { status: 403 }))) });
    await expect(setUpPilot(d, good, NOW)).rejects.toMatchObject({ status: 403 });
    expect(d.companyNames).not.toHaveBeenCalled();
    expect(d.createOrg).not.toHaveBeenCalled();
    expect(d.createInvite).not.toHaveBeenCalled();
    expect(d.sendInvite).not.toHaveBeenCalled();
  });

  it("names the wrong field and writes nothing", async () => {
    const { d } = deps();
    expect(await setUpPilot(d, { firm_name: "Alder Row", admin_email: "nope" }, NOW)).toEqual({ ok: false, reason: "invalid", field: "admin_email" });
    expect(d.createOrg).not.toHaveBeenCalled();
  });

  it("refuses a second workspace with the same name, so a double press makes one", async () => {
    const { d } = deps({ companyNames: vi.fn(async () => ["alder row partners."]) });
    expect(await setUpPilot(d, good, NOW)).toEqual({ ok: false, reason: "exists" });
    expect(d.createOrg).not.toHaveBeenCalled();
  });

  it("fails closed when the names cannot be read", async () => {
    const { d } = deps({ companyNames: vi.fn(async () => null) });
    expect(await setUpPilot(d, good, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(d.createOrg).not.toHaveBeenCalled();
  });

  it("stops when the workspace cannot be made", async () => {
    const { d } = deps({ createOrg: vi.fn(async () => null) });
    expect(await setUpPilot(d, good, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(d.createInvite).not.toHaveBeenCalled();
    expect(d.removeOrg).not.toHaveBeenCalled();
  });

  it("removes the workspace when the invite cannot be made, so nothing half made is left", async () => {
    const { d, calls } = deps({ createInvite: vi.fn(async () => Promise.reject(new Error("boom"))) });
    expect(await setUpPilot(d, good, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(calls).toEqual(["removed"]);
    expect(d.sendInvite).not.toHaveBeenCalled();
    expect(d.record).not.toHaveBeenCalled();
  });

  it("says the workspace is stuck when even the clean-up fails, never that nothing was kept (QA L1)", async () => {
    const stuck = deps({ createInvite: vi.fn(async () => null), removeOrg: vi.fn(async () => false) });
    expect(await setUpPilot(stuck.d, good, NOW)).toEqual({ ok: false, reason: "stuck" });
    const thrown = deps({ createInvite: vi.fn(async () => null), removeOrg: vi.fn(async () => Promise.reject(new Error("x"))) });
    expect(await setUpPilot(thrown.d, good, NOW)).toEqual({ ok: false, reason: "stuck" });
    expect(PILOT_COPY.stuck).not.toMatch(/Nothing was kept/);
  });

  it("records pilot.set_up as a system event, never as the founder (QA M1)", () => {
    const source = readFileSync("src/lib/pilot-setup.server.ts", "utf8");
    const call = source.slice(source.indexOf('eventType: "pilot.set_up"') - 80, source.indexOf('eventType: "pilot.set_up"') + 120);
    expect(call).toMatch(/userId: null/);
    expect(call).not.toMatch(/userId,|userId: userId/);
  });

  it("removes the workspace when clients cannot be switched on", async () => {
    const { d, calls } = deps({ ensureClientsOn: vi.fn(async () => false) });
    expect(await setUpPilot(d, good, NOW)).toEqual({ ok: false, reason: "failed" });
    expect(calls).toEqual(["removed"]);
    expect(d.createInvite).not.toHaveBeenCalled();
  });

  it.each(["not_configured", "failed"] as const)("still returns the link when the email is %s", async (emailed) => {
    const { d } = deps({ sendInvite: vi.fn(async () => emailed) });
    const result = await setUpPilot(d, good, NOW);
    expect(result).toMatchObject({ ok: true, emailed, joinUrl: expect.stringContaining("/join?code=") });
  });

  it("treats a thrown email as failed and a failed record as nothing", async () => {
    const { d } = deps({ sendInvite: vi.fn(async () => Promise.reject(new Error("x"))), record: vi.fn(async () => Promise.reject(new Error("y"))) });
    expect(await setUpPilot(d, good, NOW)).toMatchObject({ ok: true, emailed: "failed" });
  });

  it("allows only the emailed dimension on the event", () => {
    expect(EVENT_DIM_KEYS["pilot.set_up"]).toEqual(["emailed"]);
  });
});

function gateAdmin(opts: { email?: string | null; userError?: boolean; rows?: { role: string }[]; rowError?: boolean; throws?: boolean }) {
  return {
    auth: {
      admin: {
        getUserById: vi.fn(async () => {
          if (opts.throws) throw new Error("down");
          return { data: { user: { email: opts.email ?? null } }, error: opts.userError ? { message: "x" } : null };
        }),
      },
    },
    from: vi.fn(() => {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        limit: async () => ({ data: opts.rows ?? [], error: opts.rowError ? { message: "x" } : null }),
      };
      return chain;
    }),
  } as never;
}

describe("requireFounder", () => {
  it("lets a charlotte-labs.com founder through", async () => {
    await expect(requireFounder(gateAdmin({ email: "liam@charlotte-labs.com", rows: [{ role: "founder" }] }), "u1")).resolves.toBeUndefined();
  });
  it.each([
    ["no user", { email: "liam@charlotte-labs.com", rows: [{ role: "founder" }] }, null],
    ["a workspace admin elsewhere", { email: "boss@alderrow.com", rows: [{ role: "founder" }] }, "u1"],
    ["a QA person", { email: "qa.company.admin@qaprobe.test", rows: [{ role: "founder" }] }, "u1"],
    ["a demo person", { email: "hollis@kestrelbay.test", rows: [{ role: "founder" }] }, "u1"],
    ["a lookalike domain", { email: "liam@charlotte-labs.com.evil.io", rows: [{ role: "founder" }] }, "u1"],
    ["staff with ops only", { email: "ops@charlotte-labs.com", rows: [{ role: "ops" }] }, "u1"],
    ["staff with no row", { email: "ops@charlotte-labs.com", rows: [] }, "u1"],
    ["a failed user read", { email: "liam@charlotte-labs.com", userError: true, rows: [{ role: "founder" }] }, "u1"],
    ["a thrown user read", { throws: true }, "u1"],
    ["a failed row read", { email: "liam@charlotte-labs.com", rowError: true }, "u1"],
  ])("refuses %s with 403", async (_label, opts, user) => {
    await expect(requireFounder(gateAdmin(opts), user)).rejects.toMatchObject({ status: 403 });
  });
});

// QA of #286, L6: a mock that really filters, so a dropped user or active-row filter would fail these.
type Row = { user_id: string; role: string; disabled_at: string | null };
function filteringAdmin(email: string, rows: Row[]) {
  const calls: string[] = [];
  const admin = {
    auth: { admin: { getUserById: async () => ({ data: { user: { email } }, error: null }) } },
    from: (table: string) => {
      calls.push(`from:${table}`);
      let left = rows;
      const chain = {
        select: () => chain,
        eq: (key: keyof Row, value: unknown) => {
          calls.push(`eq:${key}`);
          left = left.filter((row) => row[key] === value);
          return chain;
        },
        is: (key: keyof Row, value: unknown) => {
          calls.push(`is:${key}`);
          left = left.filter((row) => row[key] === value);
          return chain;
        },
        limit: async () => ({ data: left, error: null }),
      };
      return chain;
    },
  };
  return { calls, admin: admin as never };
}

describe("requireFounder, with a mock that filters", () => {
  it("refuses a disabled founder row", async () => {
    const { admin } = filteringAdmin("liam@charlotte-labs.com", [{ user_id: "u1", role: "founder", disabled_at: "2026-01-01" }]);
    await expect(requireFounder(admin, "u1")).rejects.toMatchObject({ status: 403 });
  });
  it("does not count another person's founder row", async () => {
    const { admin } = filteringAdmin("x@charlotte-labs.com", [{ user_id: "other", role: "founder", disabled_at: null }]);
    await expect(requireFounder(admin, "u1")).rejects.toMatchObject({ status: 403 });
  });
  it("refuses an empty user id", async () => {
    const { admin } = filteringAdmin("liam@charlotte-labs.com", [{ user_id: "", role: "founder", disabled_at: null }]);
    await expect(requireFounder(admin, "")).rejects.toMatchObject({ status: 403 });
  });
  it("lets an active founder through, reading by user and active row", async () => {
    const { admin, calls } = filteringAdmin("liam@charlotte-labs.com", [{ user_id: "u1", role: "founder", disabled_at: null }]);
    await expect(requireFounder(admin, "u1")).resolves.toBeUndefined();
    expect(calls).toEqual(["from:platform_admins", "eq:user_id", "is:disabled_at"]);
  });
});
