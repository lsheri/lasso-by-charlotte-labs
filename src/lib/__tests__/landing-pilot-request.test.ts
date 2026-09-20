import { describe, expect, it } from "vitest";

import { pilotRequestSchema } from "../pilot-request.functions";

const valid = {
  name: "Liam",
  firm: "Charlotte Labs",
  email: "liam@charlotte-labs.com",
  team_size: "6-15" as const,
  note: "A real engagement",
  website: "",
};

describe("pilot request validation", () => {
  it("accepts an empty honeypot and preserves a filled honeypot for silent handling", () => {
    expect(pilotRequestSchema.parse(valid).website).toBe("");
    expect(pilotRequestSchema.parse({ ...valid, website: "spam.example" }).website).toBe(
      "spam.example",
    );
  });

  it("rejects an invalid email", () => {
    expect(pilotRequestSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(false);
  });

  it("accepts only the four team-size values", () => {
    for (const team_size of ["1-5", "6-15", "16-40", "40+"]) {
      expect(pilotRequestSchema.safeParse({ ...valid, team_size }).success).toBe(true);
    }
    expect(pilotRequestSchema.safeParse({ ...valid, team_size: "41+" }).success).toBe(false);
  });
});