import { describe, expect, it } from "vitest";

import { DEFAULT_VOCAB, EDU_VOCAB, PERSONAL_VOCAB, vocabFor } from "@/lib/edu-vocab";
import { orgTypeForChoice } from "@/lib/org-type";

describe("passO1 the door decides the workspace type", () => {
  it("maps every chooser choice to its type", () => {
    expect(orgTypeForChoice("company")).toBe("company");
    expect(orgTypeForChoice("personal")).toBe("personal");
    expect(orgTypeForChoice("edu")).toBe("edu");
  });

  it("falls back for an invite and for no choice at all", () => {
    expect(orgTypeForChoice("invite")).toBe("company");
    expect(orgTypeForChoice(null)).toBe("company");
    expect(orgTypeForChoice(undefined)).toBe("company");
  });
});

describe("passO1 school words in the work list", () => {
  it("gives a school workspace school words for the empty line and the button", () => {
    const vocab = vocabFor({ org_type: "edu" });
    expect(vocab.noEngagements).toBe("No workboards yet");
    expect(vocab.newEngagement).toBe("New workboard");
    expect(vocab.fullEngagement).toBe("Full workboard");
    expect(vocab.createEngagement).toBe("Create workboard");
    expect(vocab).toEqual(EDU_VOCAB);
  });

  it("leaves every other workspace reading exactly what it read before", () => {
    for (const profile of [null, { org_type: "company" }]) {
      expect(vocabFor(profile)).toEqual(DEFAULT_VOCAB);
    }
    expect(vocabFor({ org_type: "personal" })).toEqual(PERSONAL_VOCAB);
    expect(DEFAULT_VOCAB.noEngagements).toBe("No workboards yet");
    expect(DEFAULT_VOCAB.newEngagement).toBe("New workboard");
    expect(DEFAULT_VOCAB.fullEngagement).toBe("Full workboard");
    expect(DEFAULT_VOCAB.createEngagement).toBe("Create workboard");
  });
});
