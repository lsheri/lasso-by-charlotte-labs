import { describe, expect, it } from "vitest";

import { hasMoney, maskMoney, MONEY_WITHHELD, moneyFreeText, seesMoney, textFor, withoutMoney, moneyFreeDocument, MONEY_SECTION_WITHHELD, memberTitle, numbersWithheld, numbersWithheldInline, NUMBER_WITHHELD } from "@/lib/money-mask-shared";

describe("withoutMoney: the canvas formats", () => {
  it.each([
    ["$45k/month", ""],
    ["Fixed fee of £1.2m plus expenses", "Fixed fee of plus expenses"],
    ["EUR 90,000 for the sprint", "for the sprint"],
    ["120k retainer", "retainer"],
    ["Budget: 90,000 dollars", "Budget"],
    ["€380k", ""],
    ["CAD 2.5 million, two sites", "two sites"],
    ["45 000 € audit", "audit"],
    ["45,000€ audit", "audit"],
    ["45.000 € audit", "audit"],
    ["Fee 1.2 million", "Fee"],
    ["¥5,000,000 study", "study"],
    ["₹40 lakh", ""],
    ["3.5MM budget", "budget"],
    ["€1.200.000 programme", "programme"],
    ["USD 45 000", ""],
    ["$1.5B deal", "deal"],
    ["US$ 45,000", ""],
    ["A$80k", ""],
    ["2019 450 000 €", "2019"],
    ["Acme (GBP 1.2m)", "Acme"],
  ])("takes the money out of %s", (input, output) => {
    expect(withoutMoney(input)).toBe(output);
  });
});

describe("withoutMoney: the formats QA found next (Lows)", () => {
  it.each([
    ["2,5 Mio € Budget", "Budget"],
    ["Honorar 2,5 Mio. €", "Honorar"],
    ["1.5 Mrd € Programm", "Programm"],
    ["€ 2,5 Mio", ""],
    ["CHF 1'200'000 mandate", "mandate"],
    ["CHF 1’200’000 mandate", "mandate"],
    ["1'200'000 CHF", ""],
    ["kr 50 000 workshop", "workshop"],
    ["50 000 kr workshop", "workshop"],
    ["NOK 50 000", ""],
    ["₹12,50,000 pilot", "pilot"],
    ["Rs 12,50,000 pilot", "pilot"],
    ["INR 1,20,00,000", ""],
    ["Fee: 12,50,000 rupees", "Fee"],
    ["3 Tsd. € pro Monat", "pro Monat"],
    // QA M2 (PR 281): a fee word makes a bare figure money; codes in brackets; thin spaces.
    ["Fees: 290,000", "Fees"],
    ["A fee of 290,000 over 12 weeks", "A fee of over 12 weeks"],
    ["fee: 290 000", "fee"],
    ["day rate 1,200", "day rate"],
    ["Total: 290,000 (USD)", "Total"],
    ["290\u2009000 € audit", "audit"],
    ["€290\u2009000 audit", "audit"],
    ["a fee of 1.2 million", "a fee of"],
    ["120k retainer", "retainer"],
  ])("takes the money out of %s", (input, output) => {
    expect(withoutMoney(input)).toBe(output);
  });
});

describe("leaves counts, dates and names alone", () => {
  it.each([
    "St. Brigid Health",
    "Fund II LP materials",
    "Q4 2026 readout",
    "5 methods",
    "B2B pricing",
    "Diabetes prevention service line",
    "Top 5m customers",
    "Top 3 000 users",
    "Phase 2 of 3",
    "Series A raise",
    // QA M1 (PR 281): a scale word or k with no currency or fee word is a count.
    "Pilot 120k",
    "2 million users",
    "1.2 million patients",
    "10k users",
    "5k employees",
    "4k video",
    "50 thousand visits",
    "500 lakh people",
    "1.2bn users",
    "2 bn people",
    "12 weeks from 3 March",
    "Krakow office, 40 people",
    "Version 1.2.3",
    "Room 2'b",
    "Mio Health and Mrd Partners",
  ])("%s", (text) => {
    expect(withoutMoney(text)).toBe(text);
    expect(maskMoney(text)).toBe(text);
    expect(hasMoney(text)).toBe(false);
  });
});

describe("maskMoney keeps the sentence and marks the figure", () => {
  it.each([
    ["Fixed fee of $290k, paid monthly.", `Fixed fee of ${MONEY_WITHHELD}, paid monthly.`],
    ["Fee: $290,000 fixed", `Fee: ${MONEY_WITHHELD} fixed`],
    ["Budget 2,5 Mio € over 12 weeks", `Budget ${MONEY_WITHHELD} over 12 weeks`],
    ["Retainer of CHF 1'200'000 a year", `Retainer of ${MONEY_WITHHELD}`],
  ])("%s", (input, output) => {
    expect(maskMoney(input)).toBe(output);
  });
});

describe("moneyFreeText", () => {
  it("withholds a proposal's Fees section and masks figures elsewhere", () => {
    const doc = "## Scope\nTwelve weeks.\n\n## Fees\nFixed fee $290,000.\nExpenses at cost.\n\n## Team\nLed by Maren; budget €40k for travel.";
    const out = moneyFreeText(doc);
    expect(out).toContain("## Fees\nShown to admins and leads only.");
    expect(out).not.toContain("290");
    expect(out).toContain(`budget ${MONEY_WITHHELD} for travel`);
    expect(hasMoney(out)).toBe(false);
  });
});

describe("who reads money", () => {
  it("admins and leads only", () => {
    expect(seesMoney("admin")).toBe(true);
    expect(seesMoney("lead")).toBe(true);
    for (const role of ["em", "coach", "guest", null, undefined, ""]) expect(seesMoney(role)).toBe(false);
  });

  it("textFor leaves admins' and leads' text alone and masks it for Members", () => {
    const text = "Fee: $290,000 fixed";
    expect(textFor(text, "admin")).toBe(text);
    expect(textFor(text, "lead")).toBe(text);
    expect(textFor(text, "em")).toBe(`Fee: ${MONEY_WITHHELD} fixed`);
    expect(textFor(null, "em")).toBeNull();
  });
});

// 21 Nov 2026, QA H1 of PR 299: what a Member lead still saw in a brief or an RFP.
describe("formats a Member lead must not see (QA H1 of PR 299)", () => {
  it.each([
    ["Budget 50-60k", "50-60k"],
    ["Budget $50-60k for phase one", "$50-60k"],
    ["They pay 45 thousand a month", "45 thousand a month"],
    ["Rate 1,250/day", "1,250/day"],
    ["Price: forty thousand dollars", "forty thousand dollars"],
    ["Investment: one hundred thousand dollars", "one hundred thousand dollars"],
    ["Total not to exceed 60k", "60k"],
    ["a cap of 2.5 million", "2.5 million"],
    ["about 10k per month", "10k per month"],
    ["paid 45-50 thousand dollars last year", "45-50 thousand dollars"],
  ])("masks %s", (text, figure) => {
    expect(hasMoney(text)).toBe(true);
    expect(maskMoney(text)).not.toContain(figure);
    expect(maskMoney(text)).toContain(MONEY_WITHHELD);
  });

  it.each(["2 million users", "10k employees", "Top 5m customers", "45-50 people in the room", "Phase 2 of 3", "In 2026 they grew"])("leaves the count %s", (text) => {
    expect(maskMoney(text)).toBe(text);
  });

  it("a document's money-headed section goes whole, in any heading style, with its bare price table", () => {
    const rfp = ["Larkspur RFP", "", "Scope", "Review the care model.", "", "Pricing and payment", "Discovery: 18,000", "Delivery: 42,000", "", "Timeline", "Eight weeks."].join("\n");
    const out = moneyFreeDocument(rfp);
    expect(out).not.toMatch(/18,000|42,000/);
    expect(out).toContain(MONEY_SECTION_WITHHELD);
    expect(out).toContain("Review the care model.");
    expect(out).toContain("Eight weeks.");
    for (const heading of ["## Fees", "FEES", "Fees:", "4. Commercials", "Budget"]) {
      const doc = `${heading}\nPhase 1: 20,000\nPhase 2: 30,000\n\n## Next steps\nCall Tuesday.`;
      const masked = moneyFreeDocument(doc);
      expect(masked).not.toMatch(/20,000|30,000/);
      expect(masked).toContain("Call Tuesday.");
    }
  });

  it("a sentence that mentions fees in passing is not a heading", () => {
    const doc = "Fees are discussed on page four of the attached letter, which runs to several pages.\nThe team is five people.";
    expect(moneyFreeDocument(doc)).toBe(doc);
  });
});

describe("numbersWithheld: the blunt Member form (QA H1b of PR 299)", () => {
  it.each([
    ["Day rate: 950", "950"],
    ["The value is 230,000", "230,000"],
    ["48,500 ex VAT", "48,500"],
    ["between 120 to 150 thousand", "150 thousand"],
    ["one hundred and twenty thousand", "hundred"],
    ["fifteen hundred", "fifteen"],
    ["2.5m", "2.5m"],
  ])("withholds %s", (text, figure) => {
    expect(numbersWithheld(text)).not.toContain(figure);
    expect(numbersWithheld(text)).toContain(NUMBER_WITHHELD);
  });

  it.each(["Q4 2026 delivery", "Week 3", "3 workshops", "Call on 2026-11-24 at 10:30", "Due 21/11/2026", "Founded in 1998", "Phase 2 of 3"])("keeps %s", (text) => {
    expect(numbersWithheld(text)).toBe(text);
  });

  it("withholds whole sections under fee, cost, price, budget, rate or expense headings, in any style", () => {
    for (const heading of ["Section 5. Fees", "Costs", "## Price", "Budget:", "Day rates", "Expenses", "Cost table"]) {
      const out = numbersWithheld(`${heading}\nLine one 40\nLine two\n\nNext steps\nCall Tuesday.`);
      expect(out).not.toContain("Line one");
      expect(out).toContain(MONEY_SECTION_WITHHELD);
      expect(out).toContain("Call Tuesday.");
    }
  });

  it("a line with a figure is masked, never taken for a heading that hides what follows", () => {
    expect(numbersWithheld("Budget 50-60k\nThe team meets weekly.")).toBe(`Budget ${NUMBER_WITHHELD}\nThe team meets weekly.`);
  });

  it("the inline form never hides a section", () => {
    expect(numbersWithheldInline("Fee schedule 45,000")).toBe(`Fee schedule ${NUMBER_WITHHELD}`);
  });
});

describe("numbersWithheld: prices that look like years or are small (QA of PR 300)", () => {
  it.each([
    ["fees of 99 each", "99"],
    ["Rate 85 per hour", "85"],
    ["costs 1950", "1950"],
    ["1999 per day", "1999"],
    ["2000 each", "2000"],
    ["each workshop is 2000", "2000"],
  ])("withholds %s", (text, figure) => {
    expect(numbersWithheld(text)).not.toContain(figure);
  });
  it.each(["In 2026 they grew", "Founded 1998", "Q4 2026 delivery", "a 15% discount", "Phase 2 of 3"])("keeps %s", (text) => {
    expect(numbersWithheld(text)).toBe(text);
  });
});

describe("numbersWithheld: a bare year-like cell in a table (QA of PR 300)", () => {
  it("withholds '| Discovery | 2000 |' and a last cell, keeps a year in a sentence", () => {
    expect(numbersWithheld("| Discovery | 2000 |")).toBe(`| Discovery | ${NUMBER_WITHHELD} |`);
    expect(numbersWithheld("| Delivery | 1999")).toBe(`| Delivery | ${NUMBER_WITHHELD}`);
    expect(numbersWithheld("Kick-off in 2026 | Week 3")).toBe("Kick-off in 2026 | Week 3");
  });
});

describe("memberTitle: the one title rule for a Member (QA of PR 299 and 300)", () => {
  it.each([
    ["Budget: 45,000 for phase 2", "Budget for phase 2"],
    ["Fee 2000 refresh", "Fee refresh"],
    ["Fee schedule $45,000", "Fee schedule"],
    ["Care model review, $80k cap, phase 2", "Care model review, cap, phase 2"],
    ["$45,000", "Untitled"],
  ])("drops the amount in %s", (title, expected) => {
    expect(memberTitle(title)).toBe(expected);
  });
  it.each(["QA-299-RFP.txt", "QA 299 lead view check", "Workshop phase 2", "Q4 2026 plan"])("keeps %s", (title) => {
    expect(memberTitle(title)).toBe(title);
  });
});

describe("memberTitle, stricter (follow-up to PR 300): no money in a Member's titles", () => {
  it.each([
    ["Investment of 120,000", "Investment"],
    ["Quote 48500", "Quote"],
    ["Budget: 45,000 for phase 2", "Budget for phase 2"],
    ["Fee 2000 refresh", "Fee refresh"],
    ["Budget 45,000 - pilot", "Budget pilot"],
    ["Budget - 45,000 - pilot", "Budget pilot"],
    ["Total value 48.5k (draft)", "Total value (draft)"],
    ["Contract value 2,500,000", "Contract value"],
    ["Rate 85 per hour", "Rate"],
  ])("withholds the amount in %s", (title, expected) => {
    expect(memberTitle(title)).toBe(expected);
  });
  it.each(["QA-299-RFP.txt", "QA 299 lead view check", "Workshop phase 2", "Q4 2026 plan", "Budget for FY 2026", "Pricing review March 2026", "Strategy 2026 refresh", "Top 1000 customers", "3 workshops"])("keeps %s", (title) => {
    expect(memberTitle(title)).toBe(title);
  });
});

describe("memberTitle: the Lows from PR 301", () => {
  it.each([
    ["Fee of 99", "Fee"],
    ["Fee of 99 each (draft)", "Fee each (draft)"],
    ["Retainer 12500", "Retainer"],
    ["Proposal 12500 refresh", "Proposal refresh"],
    ["QA 301 Investment of 120,000 (safe to ignore)", "QA 301 Investment (safe to ignore)"],
  ])("%s", (title, expected) => {
    expect(memberTitle(title)).toBe(expected);
  });
  it.each(["QA-301-RFP.txt", "Q4 2026 plan", "Top 1000 customers", "Review of 3 workshops"])("keeps %s", (title) => {
    expect(memberTitle(title)).toBe(title);
  });
});

describe("memberTitle: QA L4 of PR 303", () => {
  it("'Price list 950' and 'Fee card 85' lose the figure; 'Phase 2 list' keeps its number", () => {
    expect(memberTitle("Price list 950")).toBe("Price list");
    expect(memberTitle("Fee card 85")).toBe("Fee card");
    expect(memberTitle("Phase 2 list")).toBe("Phase 2 list");
  });
});
