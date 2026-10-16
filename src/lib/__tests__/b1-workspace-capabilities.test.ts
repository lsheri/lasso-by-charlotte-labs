import { describe, expect, it } from "vitest";
import { isFirmWorkspace } from "@/lib/org-type";
import { isBusinessOrg } from "@/hooks/use-profile";
import {
  hasCoachByArrangementType,
  hasFirmView,
  hasRoster,
  isBusinessType,
  isPartnerType,
  showsAdminRole,
  type TypeLike,
} from "@/lib/workspace-capabilities";

const TYPES: TypeLike[] = ["company", "partner", "personal", "edu", null, "nonsense"];

const TRUTH: Record<
  string,
  {
    isBusinessType: boolean;
    hasRoster: boolean;
    hasFirmView: boolean;
    showsAdminRole: boolean;
    isPartnerType: boolean;
    hasCoachByArrangementType: boolean;
  }
> = {
  company: {
    isBusinessType: true,
    hasRoster: true,
    hasFirmView: true,
    showsAdminRole: true,
    isPartnerType: false,
    hasCoachByArrangementType: true,
  },
  partner: {
    isBusinessType: true,
    hasRoster: true,
    hasFirmView: false,
    showsAdminRole: true,
    isPartnerType: true,
    hasCoachByArrangementType: true,
  },
  personal: {
    isBusinessType: false,
    hasRoster: false,
    hasFirmView: false,
    showsAdminRole: false,
    isPartnerType: false,
    hasCoachByArrangementType: false,
  },
  edu: {
    isBusinessType: false,
    hasRoster: false,
    hasFirmView: false,
    showsAdminRole: false,
    isPartnerType: false,
    hasCoachByArrangementType: true,
  },
  null: {
    isBusinessType: false,
    hasRoster: false,
    hasFirmView: false,
    showsAdminRole: false,
    isPartnerType: false,
    hasCoachByArrangementType: false,
  },
  nonsense: {
    isBusinessType: false,
    hasRoster: false,
    hasFirmView: false,
    showsAdminRole: false,
    isPartnerType: false,
    hasCoachByArrangementType: true,
  },
};

describe("workspace-capabilities truth table", () => {
  for (const t of TYPES) {
    const key = t === null ? "null" : String(t);
    it(`type ${key}`, () => {
      const want = TRUTH[key];
      expect(isBusinessType(t)).toBe(want.isBusinessType);
      expect(hasRoster(t)).toBe(want.hasRoster);
      expect(hasFirmView(t)).toBe(want.hasFirmView);
      expect(showsAdminRole(t)).toBe(want.showsAdminRole);
      expect(isPartnerType(t)).toBe(want.isPartnerType);
      expect(hasCoachByArrangementType(t)).toBe(want.hasCoachByArrangementType);
    });
  }
});

describe("agreement with existing predicates", () => {
  it("isBusinessType matches isFirmWorkspace for every input", () => {
    for (const t of TYPES) {
      expect(isBusinessType(t)).toBe(isFirmWorkspace(t));
    }
  });

  it("isBusinessType matches isBusinessOrg for the four types", () => {
    for (const t of ["company", "partner", "personal", "edu"] as const) {
      expect(isBusinessType(t)).toBe(isBusinessOrg({ role: "", org_type: t }));
    }
  });

  it("a partner workspace never gets the firm view", () => {
    expect(hasFirmView("partner")).toBe(false);
  });
});
