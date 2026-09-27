import { describe, expect, it } from "vitest";

import { DEFAULT_VOCAB, EDU_VOCAB, PERSONAL_VOCAB, vocabFor } from "@/lib/edu-vocab";

const BANNED =
  /\b(score|scored|scoring|monitor|monitoring|track|tracking|tracked|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught)\b/i;

describe("pass202 personal vocab", () => {
  it("leaves a company workspace on the consulting words", () => {
    expect(vocabFor({ org_type: "company" })).toEqual(DEFAULT_VOCAB);
  });

  it("falls back to the consulting words for no profile and an unknown type", () => {
    expect(vocabFor(null)).toEqual(DEFAULT_VOCAB);
    expect(vocabFor(undefined)).toEqual(DEFAULT_VOCAB);
    expect(vocabFor({ org_type: "partner" })).toEqual(DEFAULT_VOCAB);
  });

  it("keeps the school words on the school branch", () => {
    expect(vocabFor({ org_type: "edu" })).toEqual(EDU_VOCAB);
  });

  it("gives a personal workspace the plain words", () => {
    expect(vocabFor({ org_type: "personal" })).toEqual(PERSONAL_VOCAB);
    expect(PERSONAL_VOCAB.client).toBe("Folder");
    expect(PERSONAL_VOCAB.engagement).toBe("Project");
    expect(PERSONAL_VOCAB.workstream).toBe("Step");
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
