import { describe, expect, it } from "vitest";

import { hasMoney, maskMoney, MONEY_WITHHELD, moneyFreeText, seesMoney, textFor, withoutMoney } from "@/lib/money-mask-shared";

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
    ["Pilot 120k", "Pilot"],
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
