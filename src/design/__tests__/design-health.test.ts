// Design health ratchet (17 Nov 2026): the reskin cost may only go down. See src/design/design-health.ts.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { measure, type HealthCounts } from "../design-health";

const ceilings = JSON.parse(readFileSync("src/design/design-health.json", "utf8")) as HealthCounts;
const now = measure();

describe("design health", () => {
  for (const key of Object.keys(now) as (keyof HealthCounts)[]) {
    it(`${key} stays at or below ${ceilings[key]}`, () => {
      expect(
        now[key],
        `${key} rose to ${now[key]} (ceiling ${ceilings[key]}). Use a token instead; see src/design/design-health.ts.`,
      ).toBeLessThanOrEqual(ceilings[key]);
    });
  }
});
