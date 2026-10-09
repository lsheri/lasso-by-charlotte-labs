import { describe, expect, it } from "vitest";

import {
  toPartnerShare,
  toPartnerShares,
  type PartnerShareRow,
} from "@/lib/partner-share";

function row(overrides: Partial<PartnerShareRow> = {}): PartnerShareRow {
  return {
    id: "link-1",
    coach_profile_id: "coach-1",
    institution_id: "inst-1",
    institutions: { id: "inst-1", name: "Ceiba University" },
    ...overrides,
  };
}

describe("partner share shaping", () => {
  it("a claimed link is bound", () => {
    const share = toPartnerShare(row({ coach_profile_id: "coach-9" }));
    expect(share).toEqual({
      linkId: "link-1",
      institutionId: "inst-1",
      institutionName: "Ceiba University",
      bound: true,
    });
  });

  it("an unclaimed link is not bound", () => {
    const share = toPartnerShare(row({ coach_profile_id: null }));
    expect(share?.bound).toBe(false);
    expect(share?.institutionName).toBe("Ceiba University");
  });

  it("a row with no institution is excluded", () => {
    expect(toPartnerShare(row({ institution_id: null, institutions: null }))).toBeNull();
  });

  it("a row whose institution join came back empty is excluded", () => {
    expect(toPartnerShare(row({ institutions: null }))).toBeNull();
  });

  it("an empty result gives an empty array", () => {
    expect(toPartnerShares([])).toEqual([]);
  });

  it("mixed rows keep only the sponsor links, in order", () => {
    const shares = toPartnerShares([
      row({ id: "link-a", institutions: { id: "inst-1", name: "Ceiba University" } }),
      row({ id: "link-b", institution_id: null, institutions: null }),
      row({
        id: "link-c",
        coach_profile_id: null,
        institution_id: "inst-2",
        institutions: { id: "inst-2", name: "Artemis" },
      }),
    ]);
    expect(shares.map((s) => s.linkId)).toEqual(["link-a", "link-c"]);
    expect(shares[1]).toEqual({
      linkId: "link-c",
      institutionId: "inst-2",
      institutionName: "Artemis",
      bound: false,
    });
  });
});
