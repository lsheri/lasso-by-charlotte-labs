import { describe, expect, it } from "vitest";

import {
  ASSURANCE_SUPPRESSED_SENTENCE,
  CYCLE_TIME_SUPPRESSED_SENTENCE,
  MIN_ASSURANCE_RUNS,
  MIN_CYCLE_SAMPLES,
  personIdentifyingPaths,
} from "../firm-dashboard-shared";
import { buildFirmDashboard } from "../firm-dashboard.server";

const ORG = "11111111-2222-4333-8444-555555555555";
const P1 = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";
const P2 = "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb";
const P3 = "cccccccc-3333-4333-8333-cccccccccccc";
const P4 = "dddddddd-4444-4444-8444-dddddddddddd";

function iso(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString();
}

type Row = Record<string, unknown>;

/** A stubbed Supabase client: every chained filter is a no-op, the table decides the rows. */
function stubClient(tables: Record<string, Row[]>) {
  const builder = (rows: Row[]) => {
    const result = { data: rows, count: rows.length, error: null };
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      gte: () => chain,
      in: () => chain,
      order: () => chain,
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return chain;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: (table: string) => builder(tables[table] ?? []) } as any;
}

function tablesWith(overrides: Record<string, Row[]> = {}) {
  return {
    profiles: [
      { id: P1, role: "admin", created_at: iso(60), deactivated_at: null },
      { id: P2, role: "member", created_at: iso(10), deactivated_at: null },
      { id: P3, role: "member", created_at: iso(8), deactivated_at: null },
      { id: P4, role: "coach", created_at: iso(30), deactivated_at: null },
    ],
    entitlements: [{ seats: 10 }],
    work_items: [
      { owner_id: P1, captured_at: iso(2) },
      { owner_id: P2, captured_at: iso(3) },
      { owner_id: P3, captured_at: iso(4) },
      { owner_id: P2, captured_at: iso(5) },
      { owner_id: P1, captured_at: iso(6) },
    ],
    engagements: [{ id: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee" }],
    analysis_runs: [
      { preset: "verification", created_at: iso(1) },
      { preset: "verification", created_at: iso(2) },
      { preset: "firm_checks", created_at: iso(3) },
      { preset: "firm_checks", created_at: iso(4) },
      { preset: "drift", created_at: iso(5) },
    ],
    one_on_one_notes: [{ id: "1" }],
    events: [
      { event_type: "reflect.message_sent", actor_hash: "f".repeat(64), ts: iso(1) },
      { event_type: "reflect.message_sent", actor_hash: "e".repeat(64), ts: iso(2) },
      { event_type: "mcp.push", actor_hash: "d".repeat(64), ts: iso(1) },
      { event_type: "connector.error", actor_hash: "d".repeat(64), ts: iso(3) },
    ],
    connector_accounts: [
      { profile_id: P1, toolkit: "googledrive", status: "connected" },
      { profile_id: P2, toolkit: "granola", status: "connected" },
    ],
    ai_health_events: [{ kind: "model_fallback" }],
    tasks: [
      { status: "open", delivered_at: null, accepted_at: null },
      { status: "delivered", delivered_at: iso(9), accepted_at: null },
    ],
    engagement_members: [{ engagement_id: "eeeeeeee-1111-4111-8111-eeeeeeeeeeee" }],
    ...overrides,
  };
}

function acceptedTasks(n: number): Row[] {
  return Array.from({ length: n }, () => ({
    status: "accepted",
    delivered_at: iso(9),
    accepted_at: iso(7),
  }));
}

describe("buildFirmDashboard payload", () => {
  it("returns aggregates only, with no person identifying value anywhere", async () => {
    const result = await buildFirmDashboard(stubClient(tablesWith()), ORG);
    expect(personIdentifyingPaths(result)).toEqual([]);
  });
});

describe("assurance floor", () => {
  it("is pinned at five runs", () => {
    expect(MIN_ASSURANCE_RUNS).toBe(5);
  });

  it("says so plainly below the floor", async () => {
    const runs = [
      { preset: "verification", created_at: iso(1) },
      { preset: "firm_checks", created_at: iso(2) },
    ];
    const result = await buildFirmDashboard(
      stubClient(tablesWith({ analysis_runs: runs })),
      ORG,
    );
    expect(result.assurance.enough).toBe(false);
    expect(ASSURANCE_SUPPRESSED_SENTENCE).toBe(
      "The firm has not run enough checks this period for a count to say anything yet.",
    );
  });

  it("counts at the floor", async () => {
    const result = await buildFirmDashboard(stubClient(tablesWith()), ORG);
    expect(result.assurance.total_runs).toBe(MIN_ASSURANCE_RUNS);
    expect(result.assurance.enough).toBe(true);
    expect(result.assurance.verification_runs).toBe(2);
    expect(result.assurance.firm_check_runs).toBe(2);
  });
});

describe("cycle time floor", () => {
  it("is pinned at five samples", () => {
    expect(MIN_CYCLE_SAMPLES).toBe(5);
  });

  it("suppresses with four samples and gives the exact sentence", async () => {
    const result = await buildFirmDashboard(
      stubClient(tablesWith({ tasks: acceptedTasks(MIN_CYCLE_SAMPLES - 1) })),
      ORG,
    );
    expect(result.activity.cycle_time.value).toBeNull();
    expect(result.activity.cycle_time.sentence).toBe(CYCLE_TIME_SUPPRESSED_SENTENCE);
    expect(CYCLE_TIME_SUPPRESSED_SENTENCE).toBe(
      "Not enough data yet to show how long acceptance takes.",
    );
  });

  it("shows a median at the floor", async () => {
    const result = await buildFirmDashboard(
      stubClient(tablesWith({ tasks: acceptedTasks(MIN_CYCLE_SAMPLES) })),
      ORG,
    );
    expect(result.activity.cycle_time.value).toBe(2);
  });
});
