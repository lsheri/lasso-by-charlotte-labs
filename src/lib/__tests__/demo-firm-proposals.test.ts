// 20 Nov 2026, chat pill build Phase 2: the demo firm's proposals and people are part of the seed, and reset removes
// proposals first. An in-memory stand-in for the database that filters, so scoping and order are really checked.
import { describe, expect, it, vi } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { DEMO_CONTACTS, DEMO_LOST_PROPOSALS, DEMO_OPEN_PROPOSALS, DEMO_WON_PROPOSALS, proposalDataProblems } from "@/lib/demo-firm/proposals";
import { resetDemoFirm, seedDemoProposals } from "@/lib/demo-firm/seed.server";

type Row = Record<string, unknown>;
const ORG = "org-demo";
const OTHER = "org-other";
const NOW = new Date("2026-11-21T12:00:00.000Z");

/** Tables that block a delete while rows point at them, as the live database does (on delete restrict). */
const RESTRICT: Record<string, [string, string][]> = {
  clients: [["proposals", "client_id"]],
  profiles: [["proposals", "owner_id"]],
};

function memoryDb(seed: Record<string, Row[]>) {
  const tables = new Map<string, Row[]>(Object.entries(seed).map(([name, rows]) => [name, rows.map((row) => ({ ...row }))]));
  const log: string[] = [];
  let next = 1;
  const rows = (table: string) => {
    if (!tables.has(table)) tables.set(table, []);
    return tables.get(table)!;
  };
  const from = (table: string) => {
    const filters: ((row: Row) => boolean)[] = [];
    let op: "select" | "insert" | "delete" | "update" = "select";
    let payload: Row[] = [];
    let patch: Row = {};
    const matching = () => rows(table).filter((row) => filters.every((keep) => keep(row)));
    const run = () => {
      if (op === "insert") {
        const added = payload.map((row) => ({ id: row["id"] ?? `${table}-${next++}`, ...row }));
        rows(table).push(...added);
        log.push(`insert:${table}:${added.length}`);
        return { data: added, error: null };
      }
      if (op === "delete") {
        const gone = matching();
        for (const [child, column] of RESTRICT[table] ?? [])
          if (rows(child).some((row) => gone.some((g) => g["id"] === row[column])))
            return { data: null, error: { message: `update or delete on table "${table}" violates foreign key constraint on "${child}"` } };
        tables.set(table, rows(table).filter((row) => !gone.includes(row)));
        log.push(`delete:${table}:${gone.length}`);
        return { data: gone, error: null };
      }
      if (op === "update") {
        for (const row of matching()) Object.assign(row, patch);
        return { data: matching(), error: null };
      }
      return { data: matching(), error: null };
    };
    const chain = {
      select: () => chain,
      insert: (value: Row | Row[]) => ((op = "insert"), (payload = Array.isArray(value) ? value : [value]), chain),
      delete: () => ((op = "delete"), chain),
      update: (value: Row) => ((op = "update"), (patch = value), chain),
      eq: (key: string, value: unknown) => {
        const [column, field] = key.split("->>");
        filters.push((row) => (field ? (row[column!] as Row | null)?.[field] : row[key]) === value);
        return chain;
      },
      in: (key: string, values: unknown[]) => (filters.push((row) => values.includes(row[key])), chain),
      not: () => chain,
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
  const emails = new Map(DEMO_PEOPLE.map((person) => [`u-${person.key}`, `${person.key}@kestrelbay.test`]));
  const admin = {
    from,
    storage: { from: () => ({ remove: async () => ({ data: null, error: null }) }) },
    auth: {
      admin: {
        getUserById: async (uid: string) => ({ data: { user: { id: uid, email: emails.get(uid) } }, error: null }),
        deleteUser: vi.fn(async () => ({ error: null })),
      },
    },
  };
  return { admin: admin as never, tables, log, rows };
}

/** A seeded demo firm with its boards and clients, as the board step leaves it, and another workspace beside it. */
function seededFirm(extra: Record<string, Row[]> = {}) {
  const boards = DEMO_BOARDS.map((board) => ({ id: `e-${board.key}`, org_id: ORG, title: board.title, client_id: `c-${board.key}`, owner_id: `p-${board.team[0]}`, archived_at: null }));
  const clients = DEMO_BOARDS.map((board) => ({ id: `c-${board.key}`, org_id: ORG, name: board.client.name }));
  return memoryDb({
    orgs: [
      { id: ORG, settings: { type: "company", demo_firm: "kestrel-bay" } },
      { id: OTHER, settings: { type: "company" } },
    ],
    profiles: DEMO_PEOPLE.map((person) => ({ id: `p-${person.key}`, org_id: ORG, user_id: `u-${person.key}` })),
    engagements: [...boards, { id: "e-other", org_id: OTHER, title: DEMO_BOARDS[0]!.title, client_id: "c-other", owner_id: "p-x", archived_at: null }],
    clients: [...clients, { id: "c-other", org_id: OTHER, name: DEMO_BOARDS[0]!.client.name }],
    proposals: [{ id: "p-other", org_id: OTHER, title: "Their own", client_id: "c-other", owner_id: "p-x", engagement_id: null }],
    roster_contacts: [{ id: "r-other", org_id: OTHER, full_name: "Adaeze Nwosu" }],
    proposal_ledger: [],
    ...extra,
  });
}

/** Adding a client goes through the admin partner's own session; here it writes to the same store. */
const actAs = (db: ReturnType<typeof memoryDb>) => vi.fn(async () => db.admin);

describe("the proposals data", () => {
  it("is consistent with the boards and people: no problems", () => {
    expect(proposalDataProblems(DEMO_BOARDS, DEMO_PEOPLE)).toEqual([]);
  });
  it("holds the backfill's 30 won, 9 lost and 10 people, plus the buyer script's two open proposals and their two leads", () => {
    expect(DEMO_WON_PROPOSALS).toHaveLength(30);
    expect(DEMO_LOST_PROPOSALS).toHaveLength(9);
    expect(DEMO_OPEN_PROPOSALS).toHaveLength(2);
    expect(DEMO_CONTACTS).toHaveLength(12);
    expect(DEMO_OPEN_PROPOSALS.find((p) => p.client === "Larkspur Senior Living")?.lead).toBe("johnson");
  });
  it("never covers the three proposal boards (Marrowfield, Quillbrook, Tarnhollow)", () => {
    expect(DEMO_WON_PROPOSALS.map((p) => p.board)).not.toEqual(expect.arrayContaining(["b31"]));
    for (const key of ["b31", "b32", "b33"]) expect(DEMO_WON_PROPOSALS.some((p) => p.board === key)).toBe(false);
  });
  it("catches a mistake: an unknown board, owner or lead", () => {
    const broken = DEMO_BOARDS.filter((board) => board.key !== "b12");
    expect(proposalDataProblems(broken, DEMO_PEOPLE).join("\n")).toMatch(/won: no board b12/);
    expect(proposalDataProblems(DEMO_BOARDS, DEMO_PEOPLE.filter((person) => person.key !== "whitfield")).join("\n")).toMatch(/whitfield/);
  });
  it("carries no phone number, email, fee or em dash", () => {
    const text = JSON.stringify([DEMO_CONTACTS, DEMO_LOST_PROPOSALS, DEMO_OPEN_PROPOSALS]);
    expect(text).not.toMatch(/—|@|\$|£|€|\+1\d{10}|\d{3}[-. ]\d{4}/);
  });
});

describe("seedDemoProposals", () => {
  it("writes the people, one won proposal per older board with its figures, the lost and the open ones, all in the demo workspace", async () => {
    const db = seededFirm();
    const result = await seedDemoProposals(db.admin, actAs(db), NOW);
    expect(result).toEqual({ people: 12, won: 30, lost: 9, open: 2, ledger: 30 * 3 - 3 });
    const proposals = db.rows("proposals").filter((row) => row["org_id"] === ORG);
    expect(proposals).toHaveLength(41);
    expect(db.rows("proposals").filter((row) => row["org_id"] === OTHER)).toHaveLength(1);
    expect(db.rows("roster_contacts").filter((row) => row["org_id"] === OTHER)).toHaveLength(1);

    const b12 = DEMO_BOARDS.find((board) => board.key === "b12")!;
    const orbiton = proposals.find((row) => row["engagement_id"] === "e-b12")!;
    expect(orbiton).toMatchObject({
      status: "won",
      title: b12.title,
      notes: b12.brief,
      client_id: "c-b12",
      owner_id: "p-voss",
      received_at: "2022-12-16T15:12:00Z",
      sent_at: "2022-12-18T10:30:00Z",
      decided_at: "2023-01-09T08:59:59.983Z",
    });
    const jonas = db.rows("roster_contacts").find((row) => row["full_name"] === "Jonas Edvardsen" && row["org_id"] === ORG)!;
    expect(orbiton["lead_contact_id"]).toBe(jonas["id"]);
    // No phone, email or agreement is ever seeded.
    expect(db.rows("roster_contacts").every((row) => !("phone_e164" in row) && !("email" in row))).toBe(true);
    expect(db.rows("message_consents")).toEqual([]);
    expect(db.rows("proposal_texts")).toEqual([]);

    // The firm's figures: brief received, sent (when it was), won; never for an unsent one.
    const coastal = db.rows("proposal_ledger").filter((row) => row["engagement_id"] === "e-b21").map((row) => row["kind"]);
    expect(coastal.sort()).toEqual(["brief_received", "won"]);

    const larkspur = proposals.find((row) => row["title"] === "Staffing model review")!;
    expect(larkspur).toMatchObject({ status: "open", received_at: "2026-11-20T16:00:00.000Z", sent_at: "2026-11-21T10:00:00.000Z", decided_at: null });
    expect(db.rows("clients").some((row) => row["name"] === "Larkspur Senior Living" && row["org_id"] === ORG)).toBe(true);
    const lost = proposals.filter((row) => row["status"] === "lost");
    expect(lost.every((row) => row["engagement_id"] === null && row["decided_at"])).toBe(true);
  });

  it("adds nothing on a second run", async () => {
    const db = seededFirm();
    await seedDemoProposals(db.admin, actAs(db), NOW);
    const before = db.rows("proposals").length + db.rows("proposal_ledger").length + db.rows("roster_contacts").length + db.rows("clients").length;
    expect(await seedDemoProposals(db.admin, actAs(db), NOW)).toEqual({ people: 0, won: 0, lost: 0, open: 0, ledger: 0 });
    expect(db.rows("proposals").length + db.rows("proposal_ledger").length + db.rows("roster_contacts").length + db.rows("clients").length).toBe(before);
  });

  it("leaves what live already has alone: the pasted backfill, Larkspur and Christy, a board's own outcome", async () => {
    const db = seededFirm({
      roster_contacts: [{ id: "r-christy", org_id: ORG, full_name: "Christy Johnson" }],
      clients: [...DEMO_BOARDS.map((board) => ({ id: `c-${board.key}`, org_id: ORG, name: board.client.name })), { id: "c-lark", org_id: ORG, name: "Larkspur Senior Living" }],
      proposals: [
        { id: "live-lark", org_id: ORG, title: "Staffing model review", client_id: "c-lark", owner_id: "p-hollis", engagement_id: null, lead_contact_id: "r-christy" },
        { id: "live-b12", org_id: ORG, title: "Pasted", client_id: "c-b12", owner_id: "p-voss", engagement_id: "e-b12" },
      ],
      proposal_ledger: [{ id: "l1", org_id: ORG, engagement_id: "e-b10", kind: "won" }],
    });
    const result = await seedDemoProposals(db.admin, actAs(db), NOW);
    expect(result.people).toBe(11);
    expect(result.won).toBe(29);
    expect(result.open).toBe(1);
    expect(db.rows("proposals").find((row) => row["id"] === "live-lark")!["lead_contact_id"]).toBe("r-christy");
    expect(db.rows("proposals").filter((row) => row["engagement_id"] === "e-b12")).toHaveLength(1);
    // b10 has an outcome of its own: its won proposal is written, but no second set of figures.
    expect(db.rows("proposal_ledger").filter((row) => row["engagement_id"] === "e-b10")).toHaveLength(1);
  });

  it("skips a board that is gone or archived instead of failing", async () => {
    const db = seededFirm();
    db.tables.set("engagements", db.rows("engagements").map((row) => (row["id"] === "e-b1" ? { ...row, archived_at: "2026-11-01" } : row)).filter((row) => row["id"] !== "e-b2"));
    const result = await seedDemoProposals(db.admin, actAs(db), NOW);
    expect(result.won).toBe(28);
  });

  it("refuses when there is no demo workspace", async () => {
    const db = memoryDb({ orgs: [{ id: OTHER, settings: { type: "company" } }] });
    await expect(seedDemoProposals(db.admin, actAs(db), NOW)).rejects.toThrow(/people first/);
  });
});

describe("resetDemoFirm", () => {
  it("removes proposals first, so it can finish while any exist, and touches no other workspace", async () => {
    const db = seededFirm();
    await seedDemoProposals(db.admin, actAs(db), NOW);
    db.rows("proposal_texts").push({ id: "t1", org_id: ORG, proposal_id: db.rows("proposals").find((r) => r["org_id"] === ORG)!["id"] });
    db.rows("message_consents").push({ id: "mc1", org_id: ORG, roster_contact_id: "x" }, { id: "mc2", org_id: OTHER });
    db.rows("demo_text_recipients").push({ org_id: ORG });
    db.rows("roster_contact_details").push({ roster_contact_id: "x", org_id: ORG });
    const result = await resetDemoFirm(db.admin);
    expect(result.problems).toEqual([]);
    expect(result.removed).toBe(true);
    for (const table of ["proposals", "proposal_ledger", "proposal_texts", "roster_contacts", "message_consents", "clients", "profiles", "engagements"])
      expect(db.rows(table).filter((row) => row["org_id"] === ORG)).toEqual([]);
    expect(db.rows("demo_text_recipients")).toEqual([]);
    expect(db.rows("orgs").map((row) => row["id"])).toEqual([OTHER]);
    // The other workspace keeps everything.
    expect(db.rows("proposals").filter((row) => row["org_id"] === OTHER)).toHaveLength(1);
    expect(db.rows("message_consents").filter((row) => row["org_id"] === OTHER)).toHaveLength(1);
    expect(db.rows("roster_contacts").filter((row) => row["org_id"] === OTHER)).toHaveLength(1);
    const order = db.log.filter((line) => line.startsWith("delete:"));
    expect(order.indexOf("delete:proposals:41")).toBeLessThan(order.findIndex((line) => line.startsWith("delete:clients:")));
  });

  it("then a reseed brings the proposals back", async () => {
    const db = seededFirm();
    await seedDemoProposals(db.admin, actAs(db), NOW);
    await resetDemoFirm(db.admin);
    // A fresh seed makes a new workspace and boards (new ids); the proposals follow them by title and key.
    const fresh = seededFirm();
    expect((await seedDemoProposals(fresh.admin, actAs(fresh), NOW)).won).toBe(30);
  });
});
