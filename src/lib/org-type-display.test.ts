import { describe, expect, it } from "vitest";

import { orgTypeDisplayLabel } from "./org-type";

describe("workspace type display", () => {
  it.each([
    ["company", "A company or firm"],
    ["partner", "A partner organisation"],
    ["edu", "A school or university"],
    ["personal", "Just you"],
  ] as const)("labels %s", (type, label) => {
    expect(orgTypeDisplayLabel(type)).toBe(label);
  });

  it("has a fallback for an unavailable type", () => {
    expect(orgTypeDisplayLabel(undefined)).toBe("Not set");
    expect(orgTypeDisplayLabel(null)).toBe("Not set");
  });
});