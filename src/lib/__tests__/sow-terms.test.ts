import { describe, expect, it } from "vitest";

import { choiceFromOutcome, formatOutcome, validateOutcome } from "@/lib/board-outcome-shared";
import { parseOutcome } from "@/lib/proposal-shared";
import { buildSowTerms, canSetFees, checkSuggestion, parseFee, sowTermsOf, validateSowTerms } from "@/lib/sow-terms-shared";
import { sowFacts } from "@/lib/demo-firm/plan";

describe("fee parsing", () => {
  it.each([
    ["$380k", 380_000, "fixed"],
    ["$45k/month", 45_000, "monthly"],
    ["£45,000 a month", 45_000, "monthly"],
    ["€1.2m", 1_200_000, "fixed"],
    ["USD 90,000", 90_000, "fixed"],
    ["380k GBP", 380_000, "fixed"],
    ["$120,000 per month", 120_000, "monthly"],
    ["$2 million", 2_000_000, "fixed"],
    ["$120,000 fixed", 120_000, "fixed"],
    ["fixed fee of $95,000", 95_000, "fixed"],
    ["A flat fee of £60k", 60_000, "fixed"],
    ["$120,000 fixed fee", 120_000, "fixed"],
  ])("%s reads as %d, %s", (text, amount, basis) => {
    expect(parseFee(text)).toEqual({ fee_amount: amount, fee_basis: basis });
  });

  it.each(["$300k to $350k", "time and materials", "380k", "$0", "rate card attached", "", "45,000", "$120,000 fixed plus expenses", "fixed"])(
    "%s keeps only its text, never a guessed amount",
    (text) => {
      expect(parseFee(text)).toEqual({ fee_amount: null, fee_basis: null });
    },
  );

  it("agrees with the demo seed's own reading of its fees", () => {
    for (const fee of ["$380k", "$340k", "$90k", "$45k/month"]) {
      const seed = sowFacts({ fee, weeks: 10 });
      expect(parseFee(fee)).toEqual({ fee_amount: seed.fee_amount, fee_basis: seed.fee_basis });
    }
  });
});

describe("saving terms", () => {
  it("needs a fee, allows empty weeks, and refuses odd weeks", () => {
    expect(validateSowTerms({ feeText: " ", weeks: "" })).toMatch(/Enter the fee/);
    expect(validateSowTerms({ feeText: "$380k", weeks: "" })).toBeNull();
    for (const weeks of ["0", "-3", "2.5", "ten", "261"]) expect(validateSowTerms({ feeText: "$380k", weeks })).toMatch(/whole weeks/);
    expect(validateSowTerms({ feeText: "x".repeat(81), weeks: "" })).toMatch(/80 characters/);
  });

  it("stamps who confirmed and when, and reads back the same shape the firm reader uses", () => {
    const terms = buildSowTerms({ feeText: "  £45,000   a month ", weeks: "12" }, "profile-1", new Date("2026-11-18T10:00:00Z"));
    expect(terms).toEqual({ fee_text: "£45,000 a month", fee_amount: 45_000, fee_basis: "monthly", weeks: 12, confirmed_by: "profile-1", confirmed_at: "2026-11-18T10:00:00.000Z" });
    expect(sowTermsOf({ sow_facts: terms })).toEqual({ fee_text: "£45,000 a month", fee_amount: 45_000, fee_basis: "monthly", weeks: 12 });
    expect(buildSowTerms({ feeText: "Time and materials", weeks: "" }, "p")).toMatchObject({ fee_amount: null, fee_basis: null, weeks: null });
  });

  it("ignores meta that is not terms", () => {
    for (const meta of [null, {}, { sow_facts: "x" }, { sow_facts: { weeks: 3 } }]) expect(sowTermsOf(meta)).toBeNull();
  });

  it("only admins and leads set fees", () => {
    expect(canSetFees("admin")).toBe(true);
    expect(canSetFees("lead")).toBe(true);
    for (const role of ["member", "coach", "", null, undefined]) expect(canSetFees(role)).toBe(false);
  });
});

describe("a suggestion read from the SOW", () => {
  const sow = "Statement of work. Fees: $380k fixed, invoiced monthly. The work runs 10 weeks from kickoff.";

  it("keeps a fee and length found word for word", () => {
    expect(checkSuggestion(sow, { fee_text: "$380k", weeks: 10 })).toEqual({ feeText: "$380k", weeks: "10" });
    expect(checkSuggestion("Runs for a 12-week period at £45,000 per month.", { fee_text: "£45,000 per month", weeks: "12" })).toEqual({ feeText: "£45,000 per month", weeks: "12" });
  });

  it("drops a fee the document does not state, or one with no currency mark", () => {
    expect(checkSuggestion(sow, { fee_text: "$400k", weeks: 10 }).feeText).toBe("");
    expect(checkSuggestion("Fee 380k for the work.", { fee_text: "380k", weeks: null }).feeText).toBe("");
  });

  it("drops a length the document does not state in weeks, never converting months", () => {
    expect(checkSuggestion(sow, { fee_text: "$380k", weeks: 12 }).weeks).toBe("");
    expect(checkSuggestion("The work runs three months.", { fee_text: "", weeks: 13 }).weeks).toBe("");
    expect(checkSuggestion("It runs 110 weeks.", { fee_text: "", weeks: 10 }).weeks).toBe("");
  });

  it("survives junk from the model", () => {
    for (const junk of [{}, { fee_text: 42, weeks: "x" }, { fee_text: null, weeks: 1.5 }, { fee_text: "$".repeat(200), weeks: -1 }]) {
      expect(checkSuggestion(sow, junk)).toEqual({ feeText: "", weeks: "" });
    }
  });
});

describe("how it ended", () => {
  it("round-trips through the format the precedents already read", () => {
    const outcome = formatOutcome({ plan: "overran", extended: "yes", lesson: "Book CFO time in week one" });
    expect(outcome).toBe("Overran. Client extended. Book CFO time in week one.");
    expect(parseOutcome(outcome)).toEqual({ ranToPlan: false, extended: true, lesson: "Book CFO time in week one." });
    expect(choiceFromOutcome(outcome)).toEqual({ plan: "overran", extended: "yes", lesson: "Book CFO time in week one." });
  });

  it("still running stores no outcome, so the board reads as active", () => {
    expect(formatOutcome({ plan: "running", extended: "yes", lesson: "" })).toBeNull();
    expect(choiceFromOutcome(null)).toEqual({ plan: "running", extended: "unknown", lesson: "" });
  });

  it("leaves out an unrecorded extension and an empty lesson", () => {
    expect(formatOutcome({ plan: "ran", extended: "unknown", lesson: "  " })).toBe("Ran to plan.");
    expect(parseOutcome("Ran to plan.")).toEqual({ ranToPlan: true, extended: null, lesson: null });
  });

  it("reads the seed's outcomes the same way", () => {
    expect(choiceFromOutcome("Ran to plan. Not extended. Payer talks alongside the diagnostic.")).toEqual({ plan: "ran", extended: "no", lesson: "Payer talks alongside the diagnostic." });
  });

  it("refuses a lesson on running work and an overlong lesson", () => {
    expect(validateOutcome({ plan: "running", extended: "unknown", lesson: "x" })).toMatch(/Pick ran to plan/);
    expect(validateOutcome({ plan: "ran", extended: "unknown", lesson: "x".repeat(301) })).toMatch(/300 characters/);
    expect(validateOutcome({ plan: "ran", extended: "no", lesson: "fine" })).toBeNull();
  });
});
