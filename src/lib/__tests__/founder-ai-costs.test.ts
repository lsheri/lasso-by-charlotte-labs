// 18 Nov 2026, founder AI costs: the pure grouping, the range, the money format and the staff gate behind
// /founder/costs. Person-level cost is founder accounting only and must never reach a firm, partner or member surface.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AI_COSTS_COPY,
  formatUsd,
  groupAiCosts,
  isStaffEmail,
  resolveCostRange,
  type AiUsageCostRow,
  type CostRange,
} from "@/lib/ai-costs-shared";
import { loadAiCostReport, requireCostReader } from "@/lib/ai-costs.server";

const NOW = new Date("2026-11-18T12:00:00.000Z");
const range: CostRange = resolveCostRange({ days: 7 }, NOW);

const row = (over: Partial<AiUsageCostRow>): AiUsageCostRow => ({
  org_id: "o1",
  profile_id: "p1",
  surface: "firm_ask",
  cost_usd: 0.001,
  created_at: "2026-11-17T09:00:00.000+00:00",
  ...over,
});

describe("resolveCostRange", () => {
  it("defaults to the last 7 days and lists every day, today included", () => {
    const r = resolveCostRange(undefined, NOW);
    expect(r.fromIso).toBe("2026-11-11T12:00:00.000Z");
    expect(r.toIso).toBe("2026-11-18T12:00:00.000Z");
    expect(r.days[0]).toBe("2026-11-11");
    expect(r.days.at(-1)).toBe("2026-11-18");
    expect(r.days).toHaveLength(8);
  });

  it("accepts 1 and 30 days and falls back to 7 for anything else", () => {
    expect(resolveCostRange({ days: 1 }, NOW).fromIso).toBe("2026-11-17T12:00:00.000Z");
    expect(resolveCostRange({ days: 30 }, NOW).fromIso).toBe("2026-10-19T12:00:00.000Z");
    expect(resolveCostRange({ days: 9999 }, NOW).fromIso).toBe("2026-11-11T12:00:00.000Z");
  });

  it("runs a custom range from the start of the first day to the end of the last, in UTC", () => {
    const r = resolveCostRange({ from: "2026-11-01", to: "2026-11-03" }, NOW);
    expect(r.fromIso).toBe("2026-11-01T00:00:00.000Z");
    expect(r.toIso).toBe("2026-11-04T00:00:00.000Z");
    expect(r.days).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(r.label).toBe("2026-11-01 to 2026-11-03");
  });

  it("refuses a backwards, malformed, impossible or overlong custom range", () => {
    for (const bad of [
      { from: "2026-11-05", to: "2026-11-01" },
      { from: "2026-11-01", to: "" },
      { from: "nope", to: "2026-11-01" },
      { from: "2026-02-30", to: "2026-03-01" },
      { from: "2026-01-01", to: "2026-12-31" },
    ]) {
      expect(() => resolveCostRange(bad, NOW)).toThrow(AI_COSTS_COPY.badRange);
    }
  });
});

describe("groupAiCosts", () => {
  it("returns zeros, no firms and a zero-filled day series for an empty range", () => {
    const report = groupAiCosts({ rows: [], range });
    expect(report.totals).toEqual({ calls: 0, costUsd: 0 });
    expect(report.firms).toEqual([]);
    expect(report.surfaces).toEqual([]);
    expect(report.daily).toHaveLength(8);
    expect(report.daily.every((d) => d.calls === 0 && d.costUsd === 0)).toBe(true);
  });

  it("names firms and people, counts people per firm, and splits cost per surface and day", () => {
    const report = groupAiCosts({
      range,
      orgNames: { o1: "Kestrel Bay", o2: "Northwind" },
      personNames: { p1: "Harper Quinn", p2: "maren@example.com" },
      rows: [
        row({ cost_usd: 0.01 }),
        row({ profile_id: "p2", cost_usd: 0.02, surface: "proposal_draft", created_at: "2026-11-18T01:00:00+00:00" }),
        row({ org_id: "o2", profile_id: "p3", cost_usd: 0.005 }),
      ],
    });
    expect(report.totals.calls).toBe(3);
    expect(report.totals.costUsd).toBeCloseTo(0.035, 10);
    const [kestrel, northwind] = report.firms;
    expect(kestrel!).toMatchObject({ orgId: "o1", name: "Kestrel Bay", calls: 2, people: 2 });
    expect(kestrel!.persons.map((p) => p.name)).toEqual(["maren@example.com", "Harper Quinn"]);
    expect(northwind!).toMatchObject({ name: "Northwind", people: 1 });
    expect(northwind!.persons[0]!.name).toBe(AI_COSTS_COPY.unknownPerson);
    expect(report.surfaces.map((s) => s.surface)).toEqual(["proposal_draft", "firm_ask"]);
    expect(report.surfaces[1]!.avgCostUsd).toBe(0.0075);
    expect(report.daily.find((d) => d.day === "2026-11-17")).toEqual({ day: "2026-11-17", calls: 2, costUsd: 0.015 });
    expect(report.daily.find((d) => d.day === "2026-11-18")).toEqual({ day: "2026-11-18", calls: 1, costUsd: 0.02 });
  });

  it("keeps a firm whose rows have no profile, as system calls with zero people", () => {
    const report = groupAiCosts({
      range,
      orgNames: { o1: "Kestrel Bay" },
      rows: [row({ profile_id: null, cost_usd: 0.4 }), row({ profile_id: null, cost_usd: 0.1 })],
    });
    expect(report.firms).toHaveLength(1);
    expect(report.firms[0]).toMatchObject({ name: "Kestrel Bay", calls: 2, costUsd: 0.5, people: 0 });
    expect(report.firms[0]!.persons).toEqual([
      { profileId: null, name: AI_COSTS_COPY.systemCalls, calls: 2, costUsd: 0.5 },
    ]);
  });

  it("puts a null profile beside named people without counting it as a person", () => {
    const report = groupAiCosts({
      range,
      personNames: { p1: "Harper Quinn" },
      rows: [row({}), row({ profile_id: null, cost_usd: 0.002 })],
    });
    expect(report.firms[0]!.people).toBe(1);
    expect(report.firms[0]!.persons.map((p) => p.name)).toEqual([AI_COSTS_COPY.systemCalls, "Harper Quinn"]);
  });

  it("files rows with no org under No workspace, and an org with no name as Unknown firm", () => {
    const report = groupAiCosts({ range, rows: [row({ org_id: null, cost_usd: 1 }), row({ org_id: "gone", cost_usd: 0.5 })] });
    expect(report.firms.map((f) => f.name)).toEqual([AI_COSTS_COPY.noWorkspace, AI_COSTS_COPY.unknownFirm]);
  });

  it("adds many tiny costs without float drift, and reads numeric strings", () => {
    const rows = Array.from({ length: 10 }, () => row({ cost_usd: 0.1 }));
    const report = groupAiCosts({ range, rows: [...rows, row({ cost_usd: "0.000001" }), row({ cost_usd: null })] });
    expect(report.totals.costUsd).toBe(1.000001);
    expect(report.totals.calls).toBe(12);
    // 0.1 + 0.2 in floats is 0.30000000000000004; in micro-dollars it is exact.
    expect(groupAiCosts({ range, rows: [row({ cost_usd: 0.1 }), row({ cost_usd: 0.2 })] }).totals.costUsd).toBe(0.3);
    // The average per call rounds to the micro-dollar.
    const avg = groupAiCosts({ range, rows: [row({ cost_usd: 0.000001 }), row({ cost_usd: 0.000001 }), row({ cost_usd: 0.000002 })] });
    expect(avg.surfaces[0]!.avgCostUsd).toBe(0.000001);
  });

  it("sorts firms, people and surfaces by highest cost first, then most calls, then name", () => {
    const report = groupAiCosts({
      range,
      orgNames: { a: "Alpha", b: "Bravo", c: "Charlie" },
      personNames: { x: "Xena", y: "Yusuf", z: "Zoe" },
      rows: [
        row({ org_id: "a", profile_id: "x", cost_usd: 0.1, surface: "s1" }),
        row({ org_id: "b", profile_id: "y", cost_usd: 0.9, surface: "s2" }),
        row({ org_id: "c", profile_id: "z", cost_usd: 0.03, surface: "s3" }),
        row({ org_id: "c", profile_id: "z", cost_usd: 0.03, surface: "s3" }),
        row({ org_id: "b", profile_id: "x", cost_usd: 0.05, surface: "s1" }),
      ],
    });
    expect(report.firms.map((f) => f.name)).toEqual(["Bravo", "Alpha", "Charlie"]);
    expect(report.firms[0]!.persons.map((p) => p.name)).toEqual(["Yusuf", "Xena"]);
    expect(report.surfaces.map((s) => s.surface)).toEqual(["s2", "s1", "s3"]);
    // Alpha (0.1, 1 call) and Charlie (0.1, 2 calls) tie on cost: more calls first.
    const tie = groupAiCosts({
      range,
      orgNames: { a: "Alpha", c: "Charlie" },
      rows: [row({ org_id: "a", cost_usd: 0.1 }), row({ org_id: "c", cost_usd: 0.05 }), row({ org_id: "c", cost_usd: 0.05 })],
    });
    expect(tie.firms.map((f) => f.name)).toEqual(["Charlie", "Alpha"]);
  });
});

describe("formatUsd", () => {
  it("shows four decimals under a dollar and cents above", () => {
    expect(formatUsd(0)).toBe("$0.0000");
    expect(formatUsd(0.00314)).toBe("$0.0031");
    expect(formatUsd(0.99996)).toBe("$1.0000");
    expect(formatUsd(14.01)).toBe("$14.01");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
    expect(formatUsd(Number.NaN)).toBe("$0.0000");
  });
});

describe("isStaffEmail", () => {
  it("accepts only an exact charlotte-labs.com address", () => {
    expect(isStaffEmail("liam@charlotte-labs.com")).toBe(true);
    expect(isStaffEmail("  Liam@Charlotte-Labs.com ")).toBe(true);
    for (const email of [
      "quinn@kestrelbay.test",
      "qa-admin@qaprobe.test",
      "someone@gmail.com",
      "x@lasso.charlotte-labs.com",
      "x@charlotte-labs.com.evil.com",
      "charlotte-labs.com",
      "a@b@charlotte-labs.com",
      "",
      null,
      undefined,
    ]) {
      expect(isStaffEmail(email)).toBe(false);
    }
  });
});

/** A fake admin client: auth lookups by user id, platform_admins rows and ai_usage pages. */
function fakeAdmin(opts: {
  emails: Record<string, string>;
  admins?: { user_id: string; role: string; disabled_at?: string | null }[];
  usage?: AiUsageCostRow[];
  authError?: boolean;
}) {
  const reads: string[] = [];
  const query = (table: string) => {
    const filters: Record<string, unknown> = {};
    let rangeFrom = 0;
    let rangeTo = Infinity;
    const result = () => {
      if (table === "platform_admins") {
        return (opts.admins ?? []).filter(
          (a) => a.user_id === filters["user_id"] && (a.disabled_at ?? null) === null,
        );
      }
      if (table === "ai_usage") return (opts.usage ?? []).slice(rangeFrom, rangeTo + 1);
      if (table === "orgs") return [{ id: "o1", name: "Kestrel Bay" }];
      if (table === "profiles") return [{ id: "p1", display_name: "Harper Quinn", user_id: "u-harper" }];
      return [];
    };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (col: string, v: unknown) => ((filters[col] = v), chain),
      is: () => chain,
      in: () => chain,
      gte: () => chain,
      lt: () => chain,
      order: () => chain,
      limit: () => chain,
      range: (a: number, b: number) => ((rangeFrom = a), (rangeTo = b), chain),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: result(), error: null }),
    };
    reads.push(table);
    return chain;
  };
  const admin = {
    from: query,
    insert: () => {
      throw new Error("no writes");
    },
    auth: {
      admin: {
        getUserById: async (id: string) =>
          opts.authError
            ? { data: { user: null }, error: { message: "boom" } }
            : { data: { user: opts.emails[id] ? { id, email: opts.emails[id] } : null }, error: null },
      },
    },
  };
  return { admin: admin as never, reads };
}

async function status(work: Promise<unknown>): Promise<number | "ok"> {
  try {
    await work;
    return "ok";
  } catch (e) {
    if (e instanceof Response) return e.status;
    throw e;
  }
}

describe("requireCostReader, the staff gate", () => {
  const emails = {
    liam: "liam@charlotte-labs.com",
    support: "help@charlotte-labs.com",
    qa: "qa-admin@qaprobe.test",
    demo: "hollis@kestrelbay.test",
    other: "partner@northwind.com",
    lapsed: "old@charlotte-labs.com",
  };
  const admins = [
    { user_id: "liam", role: "founder" },
    { user_id: "support", role: "support" },
    // Even with a founder row, a test domain is refused.
    { user_id: "qa", role: "founder" },
    { user_id: "demo", role: "founder" },
    { user_id: "other", role: "founder" },
    { user_id: "lapsed", role: "founder", disabled_at: "2026-11-01T00:00:00Z" },
  ];

  it("lets the founder in", async () => {
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, "liam"))).toBe("ok");
  });

  it("refuses QA, demo and other-domain users with 403, whatever their platform role", async () => {
    for (const user of ["qa", "demo", "other"]) {
      expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, user))).toBe(403);
    }
  });

  it("refuses a charlotte-labs.com address with no platform_admins row, a disabled row or a non-founder role", async () => {
    expect(await status(requireCostReader(fakeAdmin({ emails: { x: "new@charlotte-labs.com" }, admins }).admin, "x"))).toBe(403);
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, "lapsed"))).toBe(403);
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, "support"))).toBe(403);
  });

  it("refuses a signed-out caller, an unknown user and an auth lookup error", async () => {
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, undefined))).toBe(403);
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, null))).toBe(403);
    expect(await status(requireCostReader(fakeAdmin({ emails, admins }).admin, "ghost"))).toBe(403);
    expect(await status(requireCostReader(fakeAdmin({ emails, admins, authError: true }).admin, "liam"))).toBe(403);
  });

  it("reads no cost rows at all before the gate passes", async () => {
    const fake = fakeAdmin({ emails, admins, usage: [row({})] });
    expect(await status(loadAiCostReport(fake.admin, "demo", { days: 7 }, NOW))).toBe(403);
    expect(fake.reads).not.toContain("ai_usage");
    expect(fake.reads).not.toContain("profiles");
  });

  it("returns the grouped report for the founder, reading every page of rows", async () => {
    const usage = Array.from({ length: 2500 }, () => row({ cost_usd: 0.001 }));
    const fake = fakeAdmin({ emails, admins, usage });
    const report = await loadAiCostReport(fake.admin, "liam", { days: 7 }, NOW);
    expect(report.totals.calls).toBe(2500);
    expect(report.totals.costUsd).toBe(2.5);
    expect(report.firms[0]).toMatchObject({ name: "Kestrel Bay", people: 1 });
    expect(report.firms[0]!.persons[0]!.name).toBe("Harper Quinn");
    expect(fake.reads.filter((t) => t === "ai_usage")).toHaveLength(3);
  });
});

describe("where the costs may appear", () => {
  const FUNCTIONS = readFileSync("src/lib/ai-costs.functions.ts", "utf8");
  const SERVER = readFileSync("src/lib/ai-costs.server.ts", "utf8");

  it("the server function sits behind sign-in and the server gate, and writes nothing", () => {
    expect(FUNCTIONS).toContain(".middleware([requireSupabaseAuth])");
    expect(FUNCTIONS).toContain("loadAiCostReport(supabaseAdmin, context.userId, data)");
    expect(SERVER.indexOf("await requireCostReader(admin, userId)")).toBeLessThan(SERVER.indexOf("readUsageRows(admin, range"));
    for (const source of [FUNCTIONS, SERVER]) expect(source).not.toMatch(/\.(insert|update|upsert|delete|rpc)\(/);
  });

  it("only the founder route imports the cost module, and no navigation links to it", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== "__tests__") walk(path);
        } else if (/\.(ts|tsx)$/.test(name)) files.push(path);
      }
    };
    walk("src");
    const importers = files.filter((f) => /from "@\/lib\/ai-costs(-shared|\.functions|\.server)?"|from "\.\/ai-costs/.test(readFileSync(f, "utf8")));
    expect(importers.sort()).toEqual(
      // founder-gate.server.ts takes only isStaffEmail, the pure email check, for Set up a pilot; it reads no cost data.
      ["src/components/founder/AiCostsPage.tsx", "src/lib/ai-costs.functions.ts", "src/lib/ai-costs.server.ts", "src/lib/founder-gate.server.ts"].sort(),
    );
    const linkers = files.filter(
      (f) => f !== "src/routeTree.gen.ts" && f !== "src/routes/_authenticated/founder.costs.tsx" && /["'`]\/founder\/costs["'`]/.test(readFileSync(f, "utf8")),
    );
    expect(linkers).toEqual([]);
  });
});
