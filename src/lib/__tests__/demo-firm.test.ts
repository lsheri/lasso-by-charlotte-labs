// Liam, 16 Nov: the demo firm for buyer sessions. Every board must be seedable, invented and on-brand.
import { describe, expect, it } from "vitest";

import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { boardProblems, firmProblems } from "@/lib/demo-firm/validate";

describe("each demo board", () => {
  for (const board of DEMO_BOARDS) {
    it(`${board.key} ${board.client.name} is ready to seed`, () => {
      expect(boardProblems(board)).toEqual([]);
    });
  }
});

describe("the demo firm", () => {
  it("has no duplicate boards or clients", () => {
    expect(firmProblems(DEMO_BOARDS)).toEqual([]);
  });

  it("uses only .test logins and unique people", () => {
    const keys = DEMO_PEOPLE.map((person) => person.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
