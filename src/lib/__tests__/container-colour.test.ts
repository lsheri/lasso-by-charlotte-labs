import { describe, expect, it } from "vitest";

import { inheritedColour } from "@/lib/container-colour";

describe("container colour inheritance", () => {
  it("inherits from the nearest coloured ancestor", () => {
    expect(inheritedColour({ color: null }, [{ color: "blue" }, { color: "green" }])).toBe("blue");
  });

  it("lets a child colour override its parent", () => {
    expect(inheritedColour({ color: "rose" }, [{ color: "blue" }])).toBe("rose");
  });

  it("returns null when no node in the branch has a colour", () => {
    expect(inheritedColour({ color: null }, [{ color: undefined }, { color: null }])).toBeNull();
  });
});