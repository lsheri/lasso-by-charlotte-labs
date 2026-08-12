import { describe, expect, it } from "vitest";
import { longQuotes, unmatchedQuotes } from "@/lib/quote-check";
describe("quote-check", () => {
  it("ignores a dangling opening quote from a cut answer", () => {
    const a = 'He wrote "we should ship the pricing change before the board meeting" and then "the next thing we';
    expect(longQuotes(a)).toHaveLength(1);
  });
  it("matches across markdown emphasis and curly quotes", () => {
    const ctx = "we should **ship the pricing change** before the board meeting on friday";
    const ans = '\u201Cwe should ship the pricing change before the board meeting\u201D';
    expect(unmatchedQuotes(ans, ctx)).toEqual([]);
  });
  it("skips checking entirely when the answer was cut off", () => {
    expect(unmatchedQuotes('"a quote that is definitely not in the context at all here"', "nothing", true)).toEqual([]);
  });
});
