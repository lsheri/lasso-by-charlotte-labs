import { describe, expect, it, vi } from "vitest";

import { selectPending } from "../egress.server";
import { mapEventForEgress, type EgressEventRow } from "../egress-shared";

function row(overrides: Partial<EgressEventRow> = {}): EgressEventRow {
  return {
    id: 1,
    event_uuid: "uuid-1",
    event_type: "plans.viewed",
    ts: "2026-09-29T09:00:00Z",
    tenant_hash: null,
    actor_hash: null,
    org_id: null,
    schema_version: "v2",
    consent_tier: null,
    consent_ledger_version: null,
    dims: { src: "front_door" },
    payload: {},
    ...overrides,
  } as EgressEventRow;
}

function mockAdmin(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  Object.assign(builder, {
    select: vi.fn(chain),
    is: vi.fn(chain),
    not: vi.fn(chain),
    order: vi.fn(chain),
    limit: vi.fn(async () => result),
  });
  return { admin: { from: vi.fn(() => builder) }, builder };
}

describe("unit E1: workspace-less events never reach the portal", () => {
  it("excludes null-org rows in the query, so they are never loaded", async () => {
    const { admin, builder } = mockAdmin({ data: [], error: null });
    await selectPending(admin as never);
    expect(builder["not"]).toHaveBeenCalledWith("org_id", "is", null);
  });

  it("a null-org row is not forwarded even if it were loaded", () => {
    const mapped = mapEventForEgress(row());
    expect(mapped.kind).toBe("skip");
  });

  it("a row with an org_id in the same window is still forwarded", () => {
    const mapped = mapEventForEgress(
      row({ id: 2, org_id: "org-1", consent_tier: "b", actor_hash: "actor-hash" }),
    );
    expect(mapped.kind).toBe("send");
    if (mapped.kind === "send") expect(mapped.id).toBe(2);
  });

  it("the null row does not block the sweep: org rows are still selected and returned", async () => {
    const orgRow = row({ id: 2, org_id: "org-1", consent_tier: "b" });
    const { admin } = mockAdmin({ data: [orgRow], error: null });
    const rows = await selectPending(admin as never);
    // The query filter means only org-scoped rows come back; the sweep
    // advances through them with no null-org row holding the batch.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.org_id).toBe("org-1");
  });
});
