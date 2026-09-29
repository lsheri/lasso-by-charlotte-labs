import { describe, expect, it } from "vitest";

import {
  DEFAULT_VOCAB,
  EDU_VOCAB,
  PERSONAL_VOCAB,
  type Vocab,
  vocabFor,
} from "@/lib/edu-vocab";
import type { OrgType } from "@/lib/org-type";

const BANNED =
  /\b(score|scored|scoring|monitor|monitoring|track|tracking|tracked|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught)\b/i;

describe("pass202 personal vocab", () => {
  it("leaves a company workspace on the consulting words", () => {
    expect(vocabFor({ org_type: "company" })).toEqual(DEFAULT_VOCAB);
  });

  it("falls back to the consulting words for no profile, and gives partner the consulting words on purpose", () => {
    expect(vocabFor(null)).toEqual(DEFAULT_VOCAB);
    expect(vocabFor(undefined)).toEqual(DEFAULT_VOCAB);
    // partner is a real workspace type; it takes the consulting words deliberately, not as an unknown-type fallback.
    expect(vocabFor({ org_type: "partner" })).toEqual(DEFAULT_VOCAB);
  });

  it("keeps the school words on the school branch", () => {
    expect(vocabFor({ org_type: "edu" })).toEqual(EDU_VOCAB);
  });

  it("gives a personal workspace the plain words", () => {
    expect(vocabFor({ org_type: "personal" })).toEqual(PERSONAL_VOCAB);
    expect(PERSONAL_VOCAB.client).toBe("Folder");
    expect(PERSONAL_VOCAB.engagement).toBe("Workboard");
    expect(PERSONAL_VOCAB.workstream).toBe("Step");
  });

  it("uses Workboard for the middle tier in every workspace type", () => {
    const vocabularyByOrg = {
      company: DEFAULT_VOCAB,
      personal: PERSONAL_VOCAB,
      edu: EDU_VOCAB,
      partner: DEFAULT_VOCAB,
    } satisfies Record<OrgType, Vocab>;

    for (const type of Object.keys(vocabularyByOrg) as OrgType[]) {
      expect(vocabularyByOrg[type].engagement).toBe("Workboard");
    }
  });

  it("carries exactly the keys the default set carries", () => {
    expect(Object.keys(PERSONAL_VOCAB).sort()).toEqual(Object.keys(DEFAULT_VOCAB).sort());
  });

  it("uses no forbidden word in the personal copy", () => {
    for (const line of Object.values(PERSONAL_VOCAB)) {
      expect(line, line).not.toMatch(BANNED);
    }
  });

  it("uses no em dash in the personal copy", () => {
    for (const line of Object.values(PERSONAL_VOCAB)) {
      expect(line, line).not.toContain("\u2014");
    }
  });
});
