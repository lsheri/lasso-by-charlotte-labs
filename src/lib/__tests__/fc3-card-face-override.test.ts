import { describe, expect, it } from "vitest";
import { cardFaceOverrideKey, effectiveCardFace } from "@/design/reference/useCardFace";

describe("FACE-3 per-card face override", () => {
  it("keys overrides per board", () => {
    expect(cardFaceOverrideKey("abc")).toBe("lasso.cardFace.node.abc");
  });
  it("uses the board face with no override", () => {
    expect(effectiveCardFace({}, "n1", "preview")).toBe("preview");
    expect(effectiveCardFace({ n2: "art" }, "n1", "preview")).toBe("preview");
  });
  it("uses the override when present", () => {
    expect(effectiveCardFace({ n1: "art" }, "n1", "preview")).toBe("art");
  });
  it("uses the override even when it equals the board face", () => {
    expect(effectiveCardFace({ n1: "preview" }, "n1", "preview")).toBe("preview");
  });
});
