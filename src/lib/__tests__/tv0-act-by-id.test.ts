import { describe, expect, it } from "vitest";

import { TOUR_CONTENT, actById, type TourActId } from "@/lib/tour-content";

const REGISTERS = ["company", "partner", "personal", "edu"] as const;

describe("TV0 actById", () => {
  it("returns the act whose id matches, never the act at that array position", () => {
    for (const register of REGISTERS) {
      for (const act of TOUR_CONTENT[register].acts) {
        const found = actById(register, act.id);
        expect(found).toBe(act);
        expect(found?.id).toBe(act.id);
      }
      // Id 4 is the cards act; a positional read of index 4 would return the frame act.
      expect(actById(register, 4)?.cards).toHaveLength(5);
      expect(actById(register, 5)?.frameTitle).toBeTruthy();
    }
  });

  it("returns undefined for an id with no act", () => {
    for (const register of REGISTERS) {
      for (const id of [0, 8] as unknown as readonly TourActId[]) {
        expect(actById(register, id)).toBeUndefined();
      }
    }
  });
});
