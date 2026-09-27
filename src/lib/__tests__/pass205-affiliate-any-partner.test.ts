import { describe, expect, it } from "vitest";

import { isPartnerSlug } from "../partners";
import { institutionToRecord } from "../affiliation.functions";

describe("pass 205: any partner affiliates", () => {
  it("every partner slug takes the affiliate branch", () => {
    for (const slug of ["ceiba_uni", "artemis", "cabin_ai"]) expect(isPartnerSlug(slug)).toBe(true);
  });

  it("non-partner sources never do", () => {
    for (const s of ["edu", "direct", "", "nonsense"]) expect(isPartnerSlug(s)).toBe(false);
  });

  it("telemetry records unknown only for a non-empty non-partner string", () => {
    expect(institutionToRecord("artemis")).toBe("artemis");
    expect(institutionToRecord("nonsense")).toBe("unknown");
    for (const v of ["", null, undefined, 123, {}]) expect(institutionToRecord(v)).toBeNull();
  });
});
