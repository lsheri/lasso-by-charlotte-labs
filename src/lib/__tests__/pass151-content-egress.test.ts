import { describe, expect, it } from "vitest";

import {
  contentEligibility,
  mapWorkSampleForEgress,
  planContentBatch,
  textVersionNumber,
  type OrgPosture,
  type WorkItemRow,
} from "../content-egress-shared";
import { CONSENT_TEXT_VERSION } from "../data-consent-shared";

const openPosture: OrgPosture = {
  org_id: "org-1",
  org_name: "Northwind",
  tier: "d",
  tier_d_switch: true,
  ledger_version: 7,
  consent_text_version: CONSENT_TEXT_VERSION,
};

const item: WorkItemRow = {
  id: "item-1",
  org_id: "org-1",
  owner_id: "prof-1",
  title: "Q3 pricing review",
  captured_at: "2026-09-01T09:14:00Z",
  created_at_source: null,
  meta: {
    declared: { output_kind: "deck", disposition: "shipped", ai_involvement: "drafted" },
    coach_outcome: { verdict: "accept", rubric_band: 4, rework_needed: false },
  },
};

describe("content eligibility", () => {
  it("allows only full openness with the switch on at the current wording", () => {
    expect(contentEligibility(openPosture)).toEqual({ ok: true });
  });

  it("refuses anything below full openness", () => {
    expect(contentEligibility({ ...openPosture, tier: "c" })).toEqual({
      ok: false,
      reason: "below_tier_d",
    });
    expect(contentEligibility(undefined)).toEqual({ ok: false, reason: "below_tier_d" });
  });

  it("refuses full openness with the content switch off", () => {
    expect(contentEligibility({ ...openPosture, tier_d_switch: false })).toEqual({
      ok: false,
      reason: "switch_off",
    });
  });

  it("refuses a choice made under older wording", () => {
    expect(contentEligibility({ ...openPosture, consent_text_version: "dc-v2" })).toEqual({
      ok: false,
      reason: "pre_dc_v3",
    });
    expect(contentEligibility({ ...openPosture, consent_text_version: null })).toEqual({
      ok: false,
      reason: "pre_dc_v3",
    });
  });

  it("reads wording versions in order", () => {
    expect(textVersionNumber("dc-v3")).toBe(3);
    expect(textVersionNumber("nonsense")).toBe(0);
    expect(textVersionNumber(CONSENT_TEXT_VERSION)).toBeGreaterThanOrEqual(3);
  });
});

describe("mapWorkSampleForEgress", () => {
  it("carries the work verbatim, in order, with what was declared", () => {
    const sample = mapWorkSampleForEgress(item, {
      posture: openPosture,
      turns: [
        { turn_no: 2, role: "assistant", content: "Slide 6 is the soft spot." },
        { turn_no: 1, role: "user", content: "Where is the margin story weakest?" },
      ],
      analysisSummary: "pricing sanity read, complete, 3 points rendered",
      personKey: "a1b2",
    });

    expect(sample.sample_uuid).toBe("item-1");
    expect(sample.workspace_ref).toBe("org-1");
    expect(sample.workspace_name).toBe("Northwind");
    expect(sample.person_key).toBe("a1b2");
    expect(sample.output_kind).toBe("deck");
    expect(sample.consent_tier).toBe("d");
    expect(sample.consent_ledger_version).toBe(7);
    expect(sample.turns.map((t) => t.turn_no)).toEqual([1, 2]);
    expect(sample.declared["coach_outcome"]).toEqual({
      verdict: "accept",
      rubric_band: 4,
      rework_needed: false,
    });
  });
});

describe("planContentBatch", () => {
  it("never lets an item below full openness into a batch", () => {
    const plan = planContentBatch(
      [item, { ...item, id: "item-2", org_id: "org-2" }, { ...item, id: "item-3", org_id: "org-3" }],
      {
        postures: new Map<string, OrgPosture>([
          ["org-1", openPosture],
          ["org-2", { ...openPosture, org_id: "org-2", tier: "c" }],
          ["org-3", { ...openPosture, org_id: "org-3", consent_text_version: "dc-v2" }],
        ]),
        turnsByItem: new Map([["item-1", [{ turn_no: 1, role: "user", content: "hi" }]]]),
      },
    );

    expect(plan.filter((e) => e.kind === "send").map((e) => e.id)).toEqual(["item-1"]);
    expect(plan.find((e) => e.id === "item-2")).toEqual({
      kind: "skip",
      id: "item-2",
      reason: "below_tier_d",
    });
    expect(plan.find((e) => e.id === "item-3")).toEqual({
      kind: "skip",
      id: "item-3",
      reason: "pre_dc_v3",
    });
  });
});
