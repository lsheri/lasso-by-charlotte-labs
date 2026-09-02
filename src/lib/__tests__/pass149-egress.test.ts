import { describe, expect, it } from "vitest";

import {
  DEFAULT_INGEST_URL,
  buildPosture,
  mapEventForEgress,
  shouldRunEgress,
  signBody,
  type EgressEvent,
  type EgressEventRow,
} from "../egress-shared";

function row(overrides: Partial<EgressEventRow> = {}): EgressEventRow {
  return {
    id: 1,
    event_uuid: "uuid-1",
    event_type: "workitem.mapped",
    ts: "2026-09-01T09:00:00Z",
    tenant_hash: "tenant-hash",
    actor_hash: "actor-hash",
    org_id: "org-1",
    schema_version: "v2",
    consent_tier: "a",
    consent_ledger_version: 7,
    dims: { kind: "deck" },
    payload: { title: "Q3 pricing review" },
    ...overrides,
  };
}

describe("pass 149 mapping by chosen level", () => {
  it("skips rows with no level recorded", () => {
    expect(mapEventForEgress(row({ consent_tier: null }))).toEqual({
      kind: "skip",
      id: 1,
      reason: "unstamped",
    });
  });

  it("skips workspaces that chose to share nothing", () => {
    expect(mapEventForEgress(row({ consent_tier: "t0" }))).toEqual({
      kind: "skip",
      id: 1,
      reason: "t0",
    });
  });

  it("sends counts with no person key and never the payload at level a", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "a" }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event.person_key).toBeNull();
    expect(mapped.event.workspace_ref).toBe("tenant-hash");
    expect(mapped.event.dims).toEqual({ kind: "deck" });
    expect(JSON.stringify(mapped.event)).not.toContain("Q3 pricing review");
  });

  it("adds the person key at level b and still no payload", () => {
    const mapped = mapEventForEgress(row({ consent_tier: "b" }));
    if (mapped.kind !== "send") throw new Error("expected send");
    expect(mapped.event.person_key).toBe("actor-hash");
    expect(mapped.event.dims).toEqual({ kind: "deck" });
    expect(JSON.stringify(mapped.event)).not.toContain("Q3 pricing review");
  });

  it("uses workspace identity and merges payload at levels c and d", () => {
    for (const tier of ["c", "d"] as const) {
      const mapped = mapEventForEgress(
        row({ consent_tier: tier }),
        new Map([["org-1", "Charlotte Labs"]]),
      );
      if (mapped.kind !== "send") throw new Error("expected send");
      const event = mapped.event as EgressEvent;
      expect(event.workspace_ref).toBe("org-1");
      expect(event.workspace_name).toBe("Charlotte Labs");
      expect(mapped.event.person_key).toBe("actor-hash");
      expect(mapped.event.dims).toEqual({ kind: "deck", title: "Q3 pricing review" });
    }
  });
});

describe("pass 149 posture, signing and debounce", () => {
  it("builds org scope entries from state and history", () => {
    const posture = buildPosture(
      [
        {
          org_id: "org-1",
          scope: "org",
          tier: "c",
          tier_d_switch: false,
          ledger_version: 4,
          updated_at: "2026-09-01T09:00:00Z",
        },
      ],
      [
        {
          org_id: "org-1",
          scope: "org",
          old_tier: "b",
          new_tier: "c",
          new_tier_d_switch: false,
          version: 4,
          created_at: "2026-09-01T09:00:00Z",
        },
      ],
      new Map([["org-1", "Charlotte Labs"]]),
    );
    expect(posture).toHaveLength(2);
    expect(posture.every((entry) => entry.workspace_name === "Charlotte Labs")).toBe(true);
    expect(posture[1]?.old_tier).toBe("b");
  });

  it("produces a stable hex signature", async () => {
    const sig = await signBody("shared-secret", '{"a":1}');
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(await signBody("shared-secret", '{"a":1}')).toBe(sig);
    expect(await signBody("other-secret", '{"a":1}')).not.toBe(sig);
  });

  it("allows at most one sweep per minute", () => {
    expect(shouldRunEgress(null, 1_000)).toBe(true);
    expect(shouldRunEgress(1_000, 30_000)).toBe(false);
    expect(shouldRunEgress(1_000, 61_001)).toBe(true);
  });

  it("keeps the console default url", () => {
    expect(DEFAULT_INGEST_URL).toBe("https://lasso-data-console.lovable.app/api/public/ingest");
  });
});
