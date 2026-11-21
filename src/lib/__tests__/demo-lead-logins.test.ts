// 21 Nov 2026, chat pill PR 4a (D-97): in the demo only, Christy Johnson and Adaeze Nwosu are Lead logins linked to
// their People rows. Safe to run again; never touches another workspace; waits plainly before the SQL is pasted.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { DEMO_LEAD_LOGINS } from "@/lib/demo-firm/proposals";
import { seedDemoLeadLogins } from "@/lib/demo-firm/seed.server";

type Row = Record<string, unknown>;
const ORG = "org-demo";
const OTHER = "org-other";

function memoryDb(seed: Record<string, Row[]>, opts: { noLinkColumn?: boolean; users?: { id: string; email: string }[] } = {}) {
  const tables = new Map<string, Row[]>(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const users = [...(opts.users ?? [])];
  let next = 1;
  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };
  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let op: "select" | "insert" | "update" | "upsert" = "select";
    let payload: Row[] = [];
    let patch: Row = {};
    const matching = () => rows(table).filter((row) => filters.every((keep) => keep(row)));
    const run = () => {
      if (op === "insert" || op === "upsert") {
        const added = payload.map((row) => ({ id: row["id"] ?? `${table}-${next++}`, ...row }));
        rows(table).push(...added);
        return { data: added, error: null };
      }
      if (op === "select" && opts.noLinkColumn && table === "roster_contacts") return { data: null, error: { code: "42703", message: "column does not exist" } };
      if (op === "update") {
        if (opts.noLinkColumn && table === "roster_contacts" && "profile_id" in patch) return { data: null, error: { code: "42703", message: "column does not exist" } };
        const hit = matching();
        for (const row of hit) Object.assign(row, patch);
        return { data: hit, error: null };
      }
      return { data: matching(), error: null };
    };
    const chain = {
      select: () => chain,
      insert: (value: Row | Row[]) => ((op = "insert"), (payload = Array.isArray(value) ? value : [value]), chain),
      upsert: (value: Row | Row[]) => ((op = "upsert"), (payload = Array.isArray(value) ? value : [value]), chain),
      update: (value: Row) => ((op = "update"), (patch = value), chain),
      eq: (key: string, value: unknown) => (filters.push((row) => row[key] === value), chain),
      is: (key: string, value: unknown) => (filters.push((row) => (row[key] ?? null) === value), chain),
      maybeSingle: async () => {
        const result = run();
        return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error };
      },
      single: async () => {
        const result = run();
        return { data: (result.data as Row[] | null)?.[0] ?? null, error: result.error };
      },
      then: (resolve: (value: unknown) => void) => resolve(run()),
    };
    return chain;
  };
  const createUser = vi.fn(async ({ email }: { email: string; password: string }) => {
    const user = { id: `u-${email.split("@")[0]}`, email };
    users.push(user);
    return { data: { user }, error: null };
  });
  const updateUserById = vi.fn();
  const admin = {
    from,
    auth: {
      admin: {
        listUsers: async () => ({ data: { users }, error: null }),
        createUser,
        updateUserById,
      },
    },
  };
  return { admin: admin as never, tables, createUser, updateUserById };
}

const firm = () => ({
  orgs: [{ id: ORG }, { id: OTHER }],
  profiles: [{ id: "p-hollis", org_id: ORG, user_id: "u-hollis", role: "admin" }],
  roster_contacts: [
    { id: "r-christy", org_id: ORG, full_name: "Christy Johnson", profile_id: null },
    { id: "r-adaeze", org_id: ORG, full_name: "Adaeze Nwosu", profile_id: null },
    { id: "r-ben", org_id: ORG, full_name: "Ben Stanton", profile_id: null },
    { id: "r-other", org_id: OTHER, full_name: "Christy Johnson", profile_id: null },
  ],
});

describe("the demo's Lead logins", () => {
  it("are Christy Johnson and Adaeze Nwosu, as Leads, on the demo domain", () => {
    expect(DEMO_LEAD_LOGINS).toEqual([
      { contact: "johnson", role: "lead" },
      { contact: "nwosu", role: "lead" },
    ]);
  });

  it("makes both logins as Leads, links their People rows, and returns one new password for an existing demo", async () => {
    const db = memoryDb(firm());
    const result = await seedDemoLeadLogins(db.admin, ORG, null);
    expect(result.made).toEqual(["johnson@kestrelbay.test", "nwosu@kestrelbay.test"]);
    expect(result.password).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    // One password for both.
    expect(new Set(db.createUser.mock.calls.map(([args]) => args.password))).toEqual(new Set([result.password]));
    const leads = db.tables.get("profiles")!.filter((row) => row["role"] === "lead");
    expect(leads.map((row) => [row["display_name"], row["org_id"]])).toEqual([
      ["Christy Johnson", ORG],
      ["Adaeze Nwosu", ORG],
    ]);
    const roster = db.tables.get("roster_contacts")!;
    expect(roster.find((row) => row["id"] === "r-christy")!["profile_id"]).toBe(leads[0]!["id"]);
    expect(roster.find((row) => row["id"] === "r-adaeze")!["profile_id"]).toBe(leads[1]!["id"]);
    expect(result.linked).toBe(2);
    // Never another workspace's row of the same name, and nobody else's row.
    expect(roster.find((row) => row["id"] === "r-other")!["profile_id"]).toBeNull();
    expect(roster.find((row) => row["id"] === "r-ben")!["profile_id"]).toBeNull();
    expect(db.tables.get("user_active_profile")).toHaveLength(2);
  });

  it("on a fresh seed it uses the shared password and returns none of its own", async () => {
    const db = memoryDb(firm());
    const result = await seedDemoLeadLogins(db.admin, ORG, "shared-secret");
    expect(result.password).toBeNull();
    expect(db.createUser.mock.calls.every(([args]) => args.password === "shared-secret")).toBe(true);
  });

  it("run again, it makes nothing, changes no password and links nothing new", async () => {
    const db = memoryDb(firm());
    await seedDemoLeadLogins(db.admin, ORG, null);
    const again = await seedDemoLeadLogins(db.admin, ORG, null);
    expect(again).toEqual({ made: [], password: null, linked: 0, linkWaits: false });
    expect(db.createUser).toHaveBeenCalledTimes(2);
    expect(db.updateUserById).not.toHaveBeenCalled();
    expect(db.tables.get("profiles")!.filter((row) => row["role"] === "lead")).toHaveLength(2);
  });

  it("before the 4a SQL, the logins are made and the link waits, said plainly", async () => {
    const db = memoryDb(firm(), { noLinkColumn: true });
    const result = await seedDemoLeadLogins(db.admin, ORG, null);
    expect(result.made).toHaveLength(2);
    expect(result.linkWaits).toBe(true);
    expect(result.linked).toBe(0);
  });

  it("two People rows with the same name are left alone, so later runs never fail (QA L3)", async () => {
    const seed = firm();
    seed.roster_contacts.push({ id: "r-christy-2", org_id: ORG, full_name: "Christy Johnson", profile_id: null });
    const db = memoryDb(seed);
    const result = await seedDemoLeadLogins(db.admin, ORG, null);
    expect(result.linked).toBe(1);
    const roster = db.tables.get("roster_contacts")!;
    expect(roster.filter((row) => row["full_name"] === "Christy Johnson").every((row) => row["profile_id"] === null)).toBe(true);
    expect(await seedDemoLeadLogins(db.admin, ORG, null)).toMatchObject({ made: [], linked: 0 });
  });

  it("the source: the finish step runs it, and only on the demo domain", () => {
    const source = readFileSync("src/lib/demo-firm/seed.server.ts", "utf8");
    const finish = source.slice(source.indexOf("export async function finishDemoSeed"), source.indexOf("async function seedBoard("));
    expect(finish).toContain("seedDemoLeadLogins(admin, orgId, null)");
    const step = source.slice(source.indexOf("export async function seedDemoLeadLogins"));
    expect(step.slice(0, step.indexOf("\n}\n"))).toContain("demoEmail(lead.contact)");
  });
});
