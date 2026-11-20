// 19 Nov 2026: /privacy and /terms. What a carrier reviewer looks for is present, the opt-in sentence is quoted word
// for word, and nothing Liam has not supplied is stated.
import { describe, expect, it } from "vitest";

import {
  LEGAL_FACTS,
  legalDocMarkdown,
  privacyPolicy,
  termsOfUse,
} from "@/components/legal/legal-copy";
import { TEXT_CONSENT_WORDING } from "@/lib/text-consent-shared";
import { COPY as TRUST } from "@/routes/trust";

const privacy = legalDocMarkdown(privacyPolicy());
const terms = legalDocMarkdown(termsOfUse());

describe("the privacy policy", () => {
  it("has a text messages section that says what the number is for, that it is never sold or shared for marketing, and how to stop and get help", () => {
    const texts = privacyPolicy().sections.find((s) => s.id === "texts")!;
    const words = legalDocMarkdown({ ...privacyPolicy(), sections: [texts] });
    expect(words).toContain(TEXT_CONSENT_WORDING);
    expect(words).toContain(
      "Mobile numbers and text messaging consent are never sold or shared with third parties or affiliates for marketing or promotional purposes.",
    );
    expect(words).toMatch(/reply STOP/);
    expect(words).toMatch(/reply HELP/);
    expect(words).toMatch(/We use your mobile number for one purpose/);
  });

  it("repeats the promises /trust already makes, in the same words", () => {
    // The fourth promise says "data level" here, where /trust says "level": the policy has to stand on its own.
    for (const line of TRUST.never)
      expect(privacy).toContain(line.replace("your level", "your data level"));
    expect(privacy).toContain(TRUST.deletion);
    for (const [name] of TRUST.subprocessors) expect(privacy).toContain(`**${name}:**`);
    expect(privacy).toContain("**Bird:** Sending text messages.");
  });

  it("says where new workspaces start, as the sign-up notice does", () => {
    expect(privacy).toMatch(/New workspaces start at the highest level, Full work content/);
  });
});

describe("the terms", () => {
  it("cover the text programme: who sends, what, frequency, rates, STOP, HELP and carriers", () => {
    const texts = termsOfUse().sections.find((s) => s.id === "texts")!;
    const words = legalDocMarkdown({ ...termsOfUse(), sections: [texts] });
    expect(words).toContain(TEXT_CONSENT_WORDING);
    expect(words).toMatch(/Who sends: Charlotte Labs, as Lasso\./);
    expect(words).toMatch(/What we send:/);
    expect(words).toContain("Message frequency varies.");
    expect(words).toContain("Message and data rates may apply.");
    expect(words).toMatch(/Reply STOP to any message to opt out/);
    expect(words).toMatch(/Reply HELP for help/);
    expect(words).toContain("Mobile carriers are not liable for delayed or undelivered messages.");
  });
});

describe("both", () => {
  it("name the product Lasso and the company Charlotte Labs, with no em dash", () => {
    for (const words of [privacy, terms]) {
      expect(words).toMatch(/Lasso/);
      expect(words).toMatch(/Charlotte Labs/);
      expect(
        words.replaceAll("Charlotte Labs", "").replaceAll("charlotte-labs.com", ""),
      ).not.toMatch(/Charlotte/);
      expect(words).not.toMatch(/[—–]/);
    }
  });

  it("carry the two facts Liam supplied (D-43), each said where it belongs and nowhere else", () => {
    expect(LEGAL_FACTS).toMatchObject({
      legalEntity: "Charlotte Labs Inc., doing business as Lasso",
      governingState: "Washington",
    });
    expect(privacy).toContain(
      'Lasso is made and run by Charlotte Labs Inc., doing business as Lasso ("we", "us").',
    );
    expect(terms).toContain(
      "These terms are the agreement between you and Charlotte Labs Inc., doing business as Lasso, for using Lasso.",
    );
    expect(terms).toContain(
      "These terms are governed by the laws of the State of Washington, and its courts decide any dispute about them.",
    );
    expect(privacy.match(/doing business as/g)).toHaveLength(1);
    expect(terms.match(/doing business as/g)).toHaveLength(1);
    expect(terms).toContain("Who sends: Charlotte Labs, as Lasso.");
  });

  it("state nothing Liam has not supplied: Inc. once, in the company's full name (Q-48), and no address or age", () => {
    expect(LEGAL_FACTS).toMatchObject({ postalAddress: null, minimumAge: null });
    for (const words of [privacy, terms]) {
      expect(words.match(/\bInc\./g)).toHaveLength(1);
      expect(words).toContain("Charlotte Labs Inc., doing business as Lasso");
      expect(words).not.toMatch(/\b(LLC|Corp\.|Ltd)/);
      expect(words).not.toMatch(/Our address|under \d+|null|undefined/i);
    }
  });

  it("leave a sentence out while its fact is missing, and add it once supplied", () => {
    const bare = {
      ...LEGAL_FACTS,
      legalEntity: null,
      postalAddress: null,
      governingState: null,
      minimumAge: null,
    };
    expect(legalDocMarkdown(termsOfUse(bare))).not.toMatch(/governed by|State of/);
    expect(legalDocMarkdown(termsOfUse(bare))).toContain(
      "between you and Charlotte Labs for using Lasso.",
    );
    const facts = {
      ...LEGAL_FACTS,
      legalEntity: "Example Co",
      postalAddress: "1 Example St",
      governingState: "Example",
      minimumAge: 16,
    };
    const p = legalDocMarkdown(privacyPolicy(facts));
    const t = legalDocMarkdown(termsOfUse(facts));
    expect(p).toContain("Lasso is made and run by Example Co");
    expect(p).toContain("Our address is 1 Example St.");
    expect(p).toContain("Lasso is not for anyone under 16.");
    expect(t).toContain("between you and Example Co for using Lasso.");
    expect(t).toContain("governed by the laws of the State of Example");
  });

  it("give every section its own id", () => {
    for (const doc of [privacyPolicy(), termsOfUse()]) {
      const ids = doc.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});
