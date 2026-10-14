import { describe, expect, it } from "vitest";
import { promptedByTurn } from "./version-prompt";

describe("VP-1 promptedByTurn", () => {
  it("chooses the greatest strictly preceding user turn", () => {
    expect(promptedByTurn(24, [1, 7, 12, 18, 20, 22, 24, 30])).toBe(22);
  });
  it("returns undefined when nothing precedes the produced turn", () => {
    expect(promptedByTurn(1, [1, 7])).toBeUndefined();
  });
  it("returns undefined for an unknown produced turn", () => {
    expect(promptedByTurn(undefined, [1, 7])).toBeUndefined();
  });
  it("returns undefined for no user turns", () => {
    expect(promptedByTurn(5, [])).toBeUndefined();
  });
  it("handles unsorted input without mutation", () => {
    const positions = Object.freeze([30, 1, 22, 7]);
    expect(promptedByTurn(24, positions)).toBe(22);
    expect(positions).toEqual([30, 1, 22, 7]);
  });
  it("returns undefined without throwing for invalid input", () => {
    expect(promptedByTurn(24, null as unknown as number[])).toBeUndefined();
    expect(promptedByTurn(24, [NaN, -1, 2.5, Infinity])).toBeUndefined();
  });
  it("rejects non-positive and non-integer produced turns", () => {
    for (const position of [0, -3, 1.5, NaN, Infinity]) {
      expect(promptedByTurn(position, [1])).toBeUndefined();
    }
  });
});