import { describe, expect, it } from "vitest";
import { sponsorScopeLine, sponsorScopeRows, type SponsorLinkInput } from "@/lib/share-back-scope";

const ME = "me";
const ENG = "eng-1";
const link = (over: Partial<SponsorLinkInput>): SponsorLinkInput => ({
  id: "l1",
  subject_profile_id: ME,
  scope: "selected_engagements",
  ended_at: null,
  consent_withdrawn_at: null,
  sponsor_name: "Acme",
  ...over,
});

describe("sponsorScopeRows", () => {
  it("reads shared when a junction row exists for this board", () => {
    const rows = sponsorScopeRows([link({})], [{ link_id: "l1", engagement_id: ENG }], ENG, ME);
    expect(rows).toEqual([{ linkId: "l1", sponsorName: "Acme", state: "shared" }]);
  });
  it("reads not_shared with no junction row, or one for another board", () => {
    expect(sponsorScopeRows([link({})], [], ENG, ME)[0]?.state).toBe("not_shared");
    expect(
      sponsorScopeRows([link({})], [{ link_id: "l1", engagement_id: "other" }], ENG, ME)[0]?.state,
    ).toBe("not_shared");
  });
  it("reads sees_everything for an all_work link", () => {
    const rows = sponsorScopeRows([link({ scope: "all_work" })], [], ENG, ME);
    expect(rows[0]?.state).toBe("sees_everything");
  });
  it("excludes ended, consent-withdrawn and not-mine links", () => {
    const rows = sponsorScopeRows(
      [
        link({ id: "a", ended_at: "2026-01-01" }),
        link({ id: "b", consent_withdrawn_at: "2026-01-01" }),
        link({ id: "c", subject_profile_id: "someone" }),
      ],
      [],
      ENG,
      ME,
    );
    expect(rows).toEqual([]);
  });
  it("copy has no em dash", () => {
    for (const state of ["shared", "not_shared", "sees_everything"] as const) {
      expect(sponsorScopeLine({ linkId: "x", sponsorName: "Acme", state })).not.toMatch(/\u2014/);
    }
  });
});
