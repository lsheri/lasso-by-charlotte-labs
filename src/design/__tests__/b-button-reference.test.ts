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

  // 20 Nov 2026 (QA M3): the flat primary carried shadow-[var(--btn-shadow)], whose value "none" cancelled the
  // keyboard focus ring (a ring is a box shadow). Flat now means no shadow class at all.
  it("keeps the primary flat: no shadow class of any kind, never an inner shadow", () => {
    const classes = buttonVariants({ variant: "default" });
    expect(classes.split(/\s+/).filter((name) => /^shadow(-|$)/.test(name))).toEqual([]);
    expect(classes).not.toContain("inset");
  });

  it("every variant keeps the same keyboard focus ring, and none carries a shadow that could cancel it", () => {
    for (const variant of ["default", "ink", "destructive", "outline", "secondary", "ghost", "link"] as const) {
      const classes = buttonVariants({ variant });
      expect(classes, variant).toContain("focus-visible:ring-2");
      expect(classes, variant).toContain("focus-visible:ring-ring");
      expect(classes, variant).not.toContain("--btn-shadow");
    }
  });
});
