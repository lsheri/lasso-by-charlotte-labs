import { describe, expect, it } from "vitest";

import {
  GENERIC_REGION_NAMES,
  STRUCTURE_INPUT_MAX_BYTES,
  validateInput,
  validateStructure,
  validateStructures,
} from "@/lib/structure-suggest-shared";

const base = { id: "a", cut: "workstream", title: "By cost pool", why: "The call kept returning to three cost pools." };

describe("structure validator", () => {
  it("rejects a structure containing Discovery", () => {
    const result = validateStructure({ ...base, regions: ["Warehouse cost", "Discovery", "Freight lanes"] });
    expect(result).toEqual({ ok: false, reason: "generic_region_name" });
  });

  it("rejects generic names case-insensitively", () => {
    expect(validateStructure({ ...base, regions: ["Warehouse cost", "NEXT STEPS", "Freight lanes"] })).toEqual({ ok: false, reason: "generic_region_name" });
    expect(GENERIC_REGION_NAMES).toEqual(expect.arrayContaining(["discovery", "analysis", "recommendation", "next steps", "research", "findings", "conclusion", "change management", "operating model", "data and analytics", "project management", "miscellaneous", "other", "general"]));
  });

  it("rejects two and six regions, passes three and five", () => {
    expect(validateStructure({ ...base, regions: ["A cost", "B cost"] })).toEqual({ ok: false, reason: "too_few_regions" });
    expect(validateStructure({ ...base, regions: ["A", "B", "C", "D", "E", "F"] })).toEqual({ ok: false, reason: "too_many_regions" });
    expect(validateStructure({ ...base, regions: ["A", "B", "C"] }).ok).toBe(true);
    expect(validateStructure({ ...base, regions: ["A", "B", "C", "D", "E"] }).ok).toBe(true);
  });

  it("rejects a 33-character name and accepts 32", () => {
    expect(validateStructure({ ...base, regions: ["x".repeat(33), "B", "C"] })).toEqual({ ok: false, reason: "region_name_too_long" });
    expect(validateStructure({ ...base, regions: ["x".repeat(32), "B", "C"] }).ok).toBe(true);
  });

  it("rejects duplicate names inside one structure", () => {
    expect(validateStructure({ ...base, regions: ["Warehouse cost", "warehouse cost", "Freight"] })).toEqual({ ok: false, reason: "duplicate_region_name" });
  });

  it("rejects a cut outside the closed set", () => {
    expect(validateStructure({ ...base, cut: "theme", regions: ["A", "B", "C"] })).toEqual({ ok: false, reason: "bad_cut" });
  });

  it("passes a valid three-structure response through unchanged", () => {
    const structures = [
      { id: "q", cut: "question", title: "By question", why: "Two open questions drive the work.", regions: ["Asset 1 diligence", "Asset 2 diligence", "Lease exposure"] },
      { id: "d", cut: "deliverable", title: "By deliverable", why: "The board wants three outputs.", regions: ["Board memo", "Savings model", "Vendor shortlist", "Site map"] },
      { id: "w", cut: "workstream", title: "By workstream", why: "Three teams own the cost pools.", regions: ["Warehouse cost", "Procurement savings", "Freight lanes", "Fleet leases", "IT contracts"] },
    ];
    const check = validateStructures({ structures });
    expect(check.rejected).toEqual([]);
    expect(check.valid).toEqual(structures);
  });

  it("never lets a generic structure through a whole response", () => {
    const check = validateStructures({ structures: [
      { ...base, regions: ["Warehouse cost", "Freight", "Fleet"] },
      { ...base, id: "b", cut: "question", regions: ["Analysis", "Freight", "Fleet"] },
    ] });
    expect(check.valid.map((s) => s.id)).toEqual(["a"]);
    expect(check.rejected).toEqual([{ index: 1, reason: "generic_region_name" }]);
  });

  it("allows phase at most once and never repeats a cut", () => {
    const check = validateStructures([
      { ...base, id: "p1", cut: "phase", regions: ["A", "B", "C"] },
      { ...base, id: "p2", cut: "phase", regions: ["D", "E", "F"] },
      { ...base, id: "w2", regions: ["G", "H", "I"] },
      { ...base, id: "w3", regions: ["J", "K", "L"] },
    ]);
    expect(check.valid.map((s) => s.id)).toEqual(["p1", "w2"]);
    expect(check.rejected.map((r) => r.reason)).toEqual(["second_phase", "duplicate_cut"]);
  });

  it("returns nothing for a malformed response", () => {
    expect(validateStructures(null).valid).toEqual([]);
    expect(validateStructures({ structures: "x" }).valid).toEqual([]);
  });
});

describe("input cap", () => {
  it("refuses above 200 KB with a named reason", () => {
    expect(validateInput({ kind: "document", text: "a".repeat(STRUCTURE_INPUT_MAX_BYTES + 1) })).toEqual({ ok: false, reason: "text_too_large" });
    expect(validateInput({ kind: "document", text: "a".repeat(STRUCTURE_INPUT_MAX_BYTES) }).ok).toBe(true);
    expect(validateInput({ kind: "email", text: "hi" })).toEqual({ ok: false, reason: "bad_kind" });
  });
});
