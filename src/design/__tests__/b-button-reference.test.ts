// Gap 3 (17 Nov 2026): the app Button copies the reference Button's 5px radius and flat primary, so they cannot drift again.
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

describe("app Button matches src/design/reference/Button.tsx", () => {
  it("rounds every size with the reference radius, not the shared control radius", () => {
    for (const size of ["default", "sm", "lg", "icon"] as const) {
      const classes = buttonVariants({ size });
      expect(classes, size).toContain("rounded-[var(--radius-md-new)]");
      expect(classes, size).not.toContain("--radius-control");
    }
  });

  it("keeps the primary flat: its shadow is --btn-shadow, never an inner shadow", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes).toContain("shadow-[var(--btn-shadow)]");
    expect(classes).not.toContain("inset");
  });
});
