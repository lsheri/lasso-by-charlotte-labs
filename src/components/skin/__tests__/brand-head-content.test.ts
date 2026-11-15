// Phase 4 PR11: the server writes the tab title in the skin it rendered with, so Charlotte never shows "Lasso" first.
import type { RouterManagedTag } from "@tanstack/router-core";
import { describe, expect, it } from "vitest";

import { brandHeadTags } from "@/components/skin/BrandHeadContent";

const tags: RouterManagedTag[] = [
  { tag: "title", children: "Sign in | Lasso" },
  { tag: "meta", attrs: { property: "og:title", content: "Sign in | Lasso" } },
  { tag: "link", attrs: { rel: "icon", href: "/favicon.svg" } },
];

describe("brandHeadTags", () => {
  it("hands Lasso the very same tags", () => {
    expect(brandHeadTags(tags, "lasso")).toBe(tags);
  });

  it("renames only the tab title under Charlotte", () => {
    const out = brandHeadTags(tags, "charlotte");
    expect(out[0]).toEqual({ tag: "title", children: "Sign in | Charlotte" });
    expect(out.slice(1)).toEqual(tags.slice(1));
  });

  it("leaves a person's own words before the bar alone", () => {
    const own: RouterManagedTag[] = [{ tag: "title", children: "Lasso pricing notes | Lasso" }];
    expect(brandHeadTags(own, "charlotte")[0]).toEqual({ tag: "title", children: "Lasso pricing notes | Charlotte" });
  });
});
