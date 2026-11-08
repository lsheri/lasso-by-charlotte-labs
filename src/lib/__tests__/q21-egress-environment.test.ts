import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { egressEnvironment, mapEventForEgress, type EgressEventRow } from "@/lib/egress-shared";

function row(overrides: Partial<EgressEventRow> = {}): EgressEventRow {
  return {
    id: 1,
    event_uuid: "00000000-0000-4000-8000-000000000001",
    event_type: "workboard.opened",
    ts: "2026-11-07T20:00:00.000Z",
    tenant_hash: "tenant-hash",
    actor_hash: "actor-hash",
    org_id: "org-1",
    schema_version: "1",
    consent_tier: "b",
    consent_ledger_version: 3,
    dims: {},
    payload: {},
    ...overrides,
  };
}

describe("Q21 environment on egress", () => {
  it("normalises to production, preview, local or unknown, and never guesses", () => {
    expect(egressEnvironment("production")).toBe("production");
    expect(egressEnvironment("preview")).toBe("preview");
    expect(egressEnvironment("local")).toBe("local");
    expect(egressEnvironment("unknown")).toBe("unknown");
    expect(egressEnvironment(null)).toBe("unknown");
    expect(egressEnvironment(undefined)).toBe("unknown");
    expect(egressEnvironment("staging")).toBe("unknown");
  });

  it.each(["a", "b", "c", "d"])("tier %s carries the row's environment as an envelope field, not a dim", (tier) => {
    const mapped = mapEventForEgress(row({ consent_tier: tier, environment: "preview", dims: { surface: "board" } }));
    expect(mapped.kind).toBe("send");
    if (mapped.kind !== "send") return;
    expect((mapped.event as { environment?: string }).environment).toBe("preview");
    expect(mapped.event.dims).not.toHaveProperty("environment");
  });

  it("a row written before the column existed goes out as unknown", () => {
    const mapped = mapEventForEgress(row({ environment: null }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect((mapped.event as { environment?: string }).environment).toBe("unknown");
  });

  it("the anonymous model census stays constructible from the model fields and the week alone", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "t0", event_type: "model.used", environment: "preview", dims: { model_id: "m", model_raw: "m" } }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event).not.toHaveProperty("environment");
  });

  it("the sweep selects the environment column", () => {
    expect(readFileSync("src/lib/egress.server.ts", "utf8")).toMatch(/consent_ledger_version, dims, payload, environment"/);
  });
});
