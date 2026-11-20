// 19 Nov, demo tour: the two tour logins and the reset after a session. Founder only, scoped to the demo firm.
import { readFileSync } from "node:fs";

import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ org: "org-demo" as string | null, userIds: new Map<string, string>(), clearMarks: vi.fn() }));
vi.mock("../manager-tools.server", () => ({
  clearBoardExemplars: (...a: unknown[]) => m.clearMarks(...a),
}));
vi.mock("../demo-firm/seed.server", () => ({
  findDemoOrg: async () => m.org,
  findUserId: async (_admin: unknown, email: string) => m.userIds.get(email) ?? null,
  actAsDemoPerson: async () => {
    throw new Error("not in tests");
  },
}));

import { DEMO_PEOPLE, demoEmail } from "../demo-firm/people";
import { TOUR_BOARD_ID, TOUR_KEEP, TOUR_PEOPLE, tourLeftClean } from "../demo-firm/tour-keep";
import { resetTour, seedTourLogins } from "../demo-firm/tour.server";
import { TOUR_LOGIN_EMAILS } from "../firm-story-cap.server";

type Call = { table: string; op: string; args: unknown[]; filters: [string, ...unknown[]][] };

/** A stand-in for the admin client: records every call and answers reads from `rows`. */
function fakeAdmin(rows: Record<string, unknown[]>, fail: Record<string, string> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: "select", args: [], filters: [] };
    calls.push(call);
    const result = () => {
      const error = fail[`${table}.${call.op}`] ? { message: fail[`${table}.${call.op}`] } : null;
      if (call.op !== "select") return { data: call.op === "insert" ? { id: `new-${table}` } : null, error };
      let data = rows[table] ?? [];
      for (const [kind, column, value] of call.filters) {
        if (kind === "eq") data = data.filter((row) => (row as Record<string, unknown>)[column as string] === value);
        if (kind === "in") data = data.filter((row) => (value as unknown[]).includes((row as Record<string, unknown>)[column as string]));
        if (kind === "neq") data = data.filter((row) => (row as Record<string, unknown>)[column as string] !== value);
      }
      return { data, error };
    };
    const chain: Record<string, unknown> = {};
    for (const op of ["insert", "update", "delete", "upsert"]) chain[op] = (...args: unknown[]) => ((call.op = op), (call.args = args), chain);
    chain["select"] = () => chain;
    for (const kind of ["eq", "in", "neq", "not"]) chain[kind] = (...args: unknown[]) => (call.filters.push([kind, ...args]), chain);
    chain["maybeSingle"] = async () => {
      const got = result();
      return { data: Array.isArray(got.data) ? (got.data[0] ?? null) : got.data, error: got.error };
    };
    chain["single"] = chain["maybeSingle"];
    chain["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve);
    return chain;
  };
  const auth = {
    admin: {
      createUser: vi.fn(async ({ email }: { email: string }) => ({ data: { user: { id: `user-${email}` } }, error: null })),
      updateUserById: vi.fn(async () => ({ error: null })),
      getUserById: vi.fn(async () => ({ data: { user: { email: "quinn@kestrelbay.test" } }, error: null })),
    },
  };
  const remove = vi.fn(async () => ({ error: null }));
  return { admin: { from, auth, storage: { from: () => ({ remove }) } } as never, calls, auth, remove };
}

const writes = (calls: Call[]) => calls.filter((call) => call.op !== "select");
const keptLedger = TOUR_KEEP.ledger.map((row) => ({ id: row.id, engagement_id: TOUR_BOARD_ID }));
const cleanRows = () => ({
  engagements: [{ id: TOUR_BOARD_ID, org_id: "org-demo", owner_id: "quinn-profile", shared_with_firm: false }],
  proposal_ledger: [...keptLedger],
  work_items: [{ id: TOUR_KEEP.draftItemId as string, org_id: "org-demo", owner_id: "quinn-profile", content_ref: "kept.md" }],
  proposal_ledger_values: [{ engagement_id: TOUR_BOARD_ID, amount: 380000, currency: "USD" }],
  firm_exemplars: [] as unknown[],
  profiles: [{ id: "quinn-profile", org_id: "org-demo", user_id: "quinn-user" }] as unknown[],
});

beforeEach(() => {
  m.org = "org-demo";
  m.userIds = new Map();
  m.clearMarks.mockReset().mockResolvedValue({ removed: 0, error: null });
});

describe("the tour logins", () => {
  it("are two people, neither an admin, neither one of the seeded people, on the demo domain", () => {
    expect(TOUR_PEOPLE.map((person) => person.role)).toEqual(["lead", "em"]);
    for (const person of TOUR_PEOPLE) {
      expect(DEMO_PEOPLE.some((seeded) => seeded.key === person.key || seeded.name === person.name), person.key).toBe(false);
      expect(demoEmail(person.key)).toMatch(/^tour-[a-z]+@kestrelbay\.test$/);
    }
  });

  it("are exactly the logins the spend cap names", () => {
    expect(TOUR_PEOPLE.map((person) => demoEmail(person.key))).toEqual([...TOUR_LOGIN_EMAILS]);
  });

  it("each get their own new password, a profile with their role, and a place on the Marrowfield board", async () => {
    const fake = fakeAdmin(cleanRows());
    let n = 0;
    const { logins } = await seedTourLogins(fake.admin, () => `pw-${(n += 1)}`);
    expect(logins.map((login) => login.password)).toEqual(["pw-1", "pw-2"]);
    expect(fake.auth.admin.createUser).toHaveBeenCalledTimes(2);
    expect(fake.auth.admin.createUser).toHaveBeenCalledWith({ email: "tour-partner@kestrelbay.test", password: "pw-1", email_confirm: true });
    const profiles = writes(fake.calls).filter((call) => call.table === "profiles");
    expect(profiles.map((call) => (call.args[0] as { role: string; org_id: string }).role)).toEqual(["lead", "em"]);
    expect(profiles.every((call) => (call.args[0] as { org_id: string }).org_id === "org-demo")).toBe(true);
    const members = writes(fake.calls).filter((call) => call.table === "engagement_members");
    expect(members).toHaveLength(2);
    expect(members.every((call) => (call.args[0] as { engagement_id: string }).engagement_id === TOUR_BOARD_ID)).toBe(true);
  });

  it("gives an existing login a new password and makes no second profile", async () => {
    m.userIds.set("tour-partner@kestrelbay.test", "u-partner");
    m.userIds.set("tour-lead@kestrelbay.test", "u-lead");
    const rows = cleanRows();
    rows.profiles.push({ id: "p-partner", org_id: "org-demo", user_id: "u-partner" }, { id: "p-lead", org_id: "org-demo", user_id: "u-lead" });
    const fake = fakeAdmin(rows);
    await seedTourLogins(fake.admin, () => "fresh");
    expect(fake.auth.admin.createUser).not.toHaveBeenCalled();
    expect(fake.auth.admin.updateUserById).toHaveBeenCalledTimes(2);
    expect(writes(fake.calls).some((call) => call.table === "profiles")).toBe(false);
  });

  it("refuses when the demo firm or the board is not there, before creating anyone", async () => {
    m.org = null;
    const none = fakeAdmin(cleanRows());
    await expect(seedTourLogins(none.admin, () => "x")).rejects.toThrow("not seeded");
    m.org = "org-demo";
    const noBoard = fakeAdmin({ ...cleanRows(), engagements: [] });
    await expect(seedTourLogins(noBoard.admin, () => "x")).rejects.toThrow("Marrowfield");
    expect(none.auth.admin.createUser).not.toHaveBeenCalled();
    expect(noBoard.auth.admin.createUser).not.toHaveBeenCalled();
  });
});

describe("the reset", () => {
  it("knows what clean means: not shared, three ledger rows, USD 380,000, no marks, the draft there", () => {
    const clean = { shared: false, ledgerRows: 3, value: "380000 USD", marks: 0, draft: true };
    expect(tourLeftClean(clean)).toBe(true);
    for (const off of [{ shared: true }, { ledgerRows: 4 }, { ledgerRows: 2 }, { value: "380000 GBP" }, { value: null }, { marks: 1 }, { draft: false }]) {
      expect(tourLeftClean({ ...clean, ...off }), JSON.stringify(off)).toBe(false);
    }
    expect(TOUR_KEEP.ledger).toHaveLength(3);
    expect(TOUR_KEEP.value).toEqual({ amount: 380000, currency: "USD" });
  });

  it.each([
    ["the demo firm is not seeded", () => ((m.org = null), cleanRows())],
    ["the board is missing", () => ({ ...cleanRows(), engagements: [] })],
    ["a kept ledger row is missing", () => ({ ...cleanRows(), proposal_ledger: keptLedger.slice(0, 2) })],
    ["the kept draft is missing", () => ({ ...cleanRows(), work_items: [] })],
  ])("refuses and writes nothing when %s", async (_name, rows) => {
    const fake = fakeAdmin(rows());
    const result = await resetTour(fake.admin, async () => {
      throw new Error("must not sign in");
    });
    expect(result).toMatchObject({ ok: false, refused: true, left: null });
    expect(writes(fake.calls)).toEqual([]);
    expect(m.clearMarks).not.toHaveBeenCalled();
    expect(fake.remove).not.toHaveBeenCalled();
  });

  it("on a clean board touches only the Marrowfield board, and reports it clean", async () => {
    const fake = fakeAdmin(cleanRows());
    const actAs = vi.fn();
    const result = await resetTour(fake.admin, actAs);
    expect(result.ok).toBe(true);
    expect(result.left).toEqual({ shared: false, ledgerRows: 3, value: "380000 USD", marks: 0, draft: true });
    expect(actAs).not.toHaveBeenCalled();
    for (const call of writes(fake.calls)) {
      const scoped = call.filters.some(([, column, value]) => (column === "engagement_id" || column === "id" || column === "subject_id") && value === TOUR_BOARD_ID);
      expect(scoped, `${call.table}.${call.op}`).toBe(true);
    }
    expect(writes(fake.calls).some((call) => call.table === "work_items")).toBe(false);
  });

  it("un-shares through the product's own function as the board's owner, never by writing the columns", async () => {
    const rows = cleanRows();
    rows.engagements[0]!.shared_with_firm = true;
    const fake = fakeAdmin(rows);
    const rpc = vi.fn(async () => ({ error: null }));
    const actAs = vi.fn(async () => ({ rpc }) as never);
    await resetTour(fake.admin, actAs);
    expect(actAs).toHaveBeenCalledWith("quinn@kestrelbay.test");
    expect(rpc).toHaveBeenCalledWith("set_engagement_firm_share", { p_engagement: TOUR_BOARD_ID, p_on: false });
    const engagementWrites = writes(fake.calls).filter((call) => call.table === "engagements");
    expect(engagementWrites.map((call) => call.args[0])).toEqual([{ outcome: null }]);
  });

  it("is not clean, and says why, when the board is still shared afterwards", async () => {
    const rows = cleanRows();
    rows.engagements[0]!.shared_with_firm = true;
    const fake = fakeAdmin(rows);
    const result = await resetTour(fake.admin, async () => {
      throw new Error("sign-in failed");
    });
    expect(result.ok).toBe(false);
    expect(result.refused).toBe(false);
    expect(result.problems.join(" ")).toContain("un-sharing the board: sign-in failed");
    expect(result.left?.shared).toBe(true);
  });

  it("removes only ledger rows other than the three kept, and puts the kept rows and the value back", async () => {
    const fake = fakeAdmin(cleanRows());
    await resetTour(fake.admin, vi.fn());
    const ledger = writes(fake.calls).filter((call) => call.table === "proposal_ledger");
    const removal = ledger.find((call) => call.op === "delete");
    expect(removal?.filters).toContainEqual(["not", "id", "in", `(${TOUR_KEEP.ledger.map((row) => row.id).join(",")})`]);
    expect(ledger.filter((call) => call.op === "update").map((call) => call.filters[0]?.[2])).toEqual(TOUR_KEEP.ledger.map((row) => row.id));
    const value = writes(fake.calls).find((call) => call.table === "proposal_ledger_values");
    expect(value?.args[0]).toEqual({ amount: 380000, currency: "USD" });
  });

  it("removes work the tour logins made and its files, never the kept draft or anyone else's work", async () => {
    m.userIds.set("tour-lead@kestrelbay.test", "u-lead");
    const rows = cleanRows();
    rows.profiles.push({ id: "p-lead", org_id: "org-demo", user_id: "u-lead" });
    rows.work_items.push({ id: "tour-draft", org_id: "org-demo", owner_id: "p-lead", content_ref: "tour.md" }, { id: "other", org_id: "org-demo", owner_id: "someone-else", content_ref: "other.md" });
    const fake = fakeAdmin(rows);
    await resetTour(fake.admin, vi.fn());
    const removal = writes(fake.calls).find((call) => call.table === "work_items" && call.op === "delete");
    expect(removal?.filters).toContainEqual(["in", "id", ["tour-draft"]]);
    expect(removal?.filters).toContainEqual(["eq", "org_id", "org-demo"]);
    expect(fake.remove).toHaveBeenCalledWith(["tour.md"]);
  });

  it("reports a step that failed and is then not clean", async () => {
    const fake = fakeAdmin(cleanRows());
    m.clearMarks.mockResolvedValueOnce({ removed: 0, error: { message: "refused" } });
    const result = await resetTour(fake.admin, vi.fn());
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("marks: refused");
  });

  it("removes marks only through the firm brain's own function, for this board in this firm, and is not clean if any were still there", async () => {
    const fake = fakeAdmin(cleanRows());
    await resetTour(fake.admin, vi.fn());
    expect(m.clearMarks.mock.calls.map((call) => call.slice(1))).toEqual([["org-demo", TOUR_BOARD_ID], ["org-demo", TOUR_BOARD_ID]]);
    m.clearMarks.mockReset().mockResolvedValueOnce({ removed: 2, error: null }).mockResolvedValueOnce({ removed: 1, error: null });
    const result = await resetTour(fakeAdmin(cleanRows()).admin, vi.fn());
    expect(result.left?.marks).toBe(1);
    expect(result.ok).toBe(false);
  });
});

describe("who can reach them", () => {
  it("both server functions are signed-in only and founder only", () => {
    const source = readFileSync("src/lib/demo-firm.functions.ts", "utf8");
    for (const name of ["seedTourLoginsFn", "resetTourFn"]) {
      const body = source.slice(source.indexOf(`export const ${name} `));
      const end = body.indexOf("\n  });");
      expect(body.slice(0, end), name).toMatch(/\.middleware\(\[requireSupabaseAuth\]\)/);
      expect(body.slice(0, end), name).toMatch(/const admin = await founderOnly\(context, data\.profile_id\);/);
    }
  });

  it("nothing in the story or the app shell calls them: only the QA seed panel does", () => {
    for (const file of ["src/components/firm-story/FirmStory.tsx", "src/components/firm-story/FirmStoryCard.tsx", "src/components/layout/AppShell.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/seedTourLoginsFn|resetTourFn|tour\.server/);
    }
  });

  it("the reset never names a table outside the board's own, and the kept ids are not sent by the browser", () => {
    const source = readFileSync("src/lib/demo-firm/tour.server.ts", "utf8");
    const tables = [...source.matchAll(/\.from\("([a-z_-]+)"\)/g)].map((hit) => hit[1]);
    expect([...new Set(tables)].sort()).toEqual(["engagement_members", "engagements", "notifications", "profiles", "proposal_ledger", "proposal_ledger_values", "user_active_profile", "work-files", "work_items"]);
    expect(readFileSync("src/components/qa/TourSeedPanel.tsx", "utf8")).not.toMatch(/tour-keep|TOUR_KEEP/);
  });
});
