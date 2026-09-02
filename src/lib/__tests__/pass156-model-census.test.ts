import { describe, expect, it } from "vitest";

import { mapEventForEgress, weekStartIso, type EgressEventRow } from "../egress-shared";

function row(overrides: Partial<EgressEventRow> = {}): EgressEventRow {
  return {
    id: 9,
    event_uuid: "uuid-9",
    event_type: "model.used",
    ts: "2026-09-02T13:45:12Z",
    tenant_hash: "tenant-hash-secret",
    actor_hash: "actor-hash-secret",
    org_id: "org-secret",
    schema_version: "v2",
    consent_tier: "t0",
    consent_ledger_version: 4,
    dims: { vendor: "openai", model_id: "gpt-4o", model_raw: "gpt-4o-2024-11-20" },
    payload: { title: "Q3 pricing review" },
    ...overrides,
  };
}

describe("pass 156 model census", () => {
  it("truncates to the UTC week start (Monday)", () => {
    expect(weekStartIso("2026-09-02T13:45:12Z")).toBe("2026-08-31T00:00:00.000Z");
  });

  it("maps a t0 model.used to an identity-free census record", () => {
    const mapped = mapEventForEgress(row());
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event).toEqual({
      event_uuid: "uuid-9",
      event_name: "model.census",
      event_ts: "2026-08-31T00:00:00.000Z",
      workspace_ref: "census",
      person_key: null,
      consent_tier: "census",
      schema_version: "v2",
      dims: { model_id: "gpt-4o", model_raw: "gpt-4o-2024-11-20" },
    });
    const json = JSON.stringify(mapped.event);
    for (const secret of ["tenant-hash-secret", "actor-hash-secret", "org-secret", "13:45"]) {
      expect(json).not.toContain(secret);
    }
  });

  it("falls back to the unknown buckets", () => {
    const mapped = mapEventForEgress(row({ dims: { vendor: "openai" } }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event.dims).toEqual({ model_id: "unrecognized", model_raw: "undisclosed" });
  });

  it("still skips other t0 events and unstamped model.used", () => {
    expect(mapEventForEgress(row({ event_type: "thread.shape" })).kind).toBe("skip");
    expect(mapEventForEgress(row({ event_type: "thread.shape" }))).toMatchObject({ reason: "t0" });
    expect(mapEventForEgress(row({ consent_tier: null }))).toMatchObject({ reason: "unstamped" });
  });

  it("leaves tier a-d model.used mapping unchanged", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "a" }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event.event_name).toBe("model.used");
    expect(mapped.event.workspace_ref).toBe("tenant-hash-secret");
  });
});
