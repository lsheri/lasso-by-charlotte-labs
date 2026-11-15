// Phase 4 PR11: the server writes the tab title in the skin it rendered with, so Charlotte never shows "Lasso" first.
import type { RouterManagedTag } from "@tanstack/router-core";
import { describe, expect, it } from "vitest";

import { brandHeadTags } from "@/components/skin/BrandHeadContent";

const tags: RouterManagedTag[] = [
  { tag: "title", children: "Sign in | Lasso" },
  { tag: "meta", attrs: { property: "og:title", content: "Sign in | Lasso" } },
  { tag: "link", attrs: { rel: "stylesheet", href: "/src/styles.css" } },
];

describe("brandHeadTags", () => {
  it("hands Lasso the very same tags", () => {
    expect(brandHeadTags(tags, "lasso")).toBe(tags);
  });

  it("renames the tab title under Charlotte and leaves other tags alone", () => {
    const out = brandHeadTags(tags, "charlotte");
    expect(out[0]).toEqual({ tag: "title", children: "Sign in | Charlotte" });
    expect(out.slice(1)).toEqual(tags.slice(1));
  });

  it("leaves a person's own words before the bar alone", () => {
    const own: RouterManagedTag[] = [{ tag: "title", children: "Lasso pricing notes | Lasso" }];
    expect(brandHeadTags(own, "charlotte")[0]).toEqual({ tag: "title", children: "Lasso pricing notes | Charlotte" });
  });
});

// Phase 4 PR12: under Charlotte the head points at Charlotte's icons, manifest, app name and preview image.
describe("brandHeadTags icons", () => {
  const head: RouterManagedTag[] = [
    { tag: "link", attrs: { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" } },
    { tag: "link", attrs: { rel: "icon", href: "/favicon-32.png", sizes: "32x32" } },
    { tag: "link", attrs: { rel: "apple-touch-icon", href: "/apple-touch-icon.png" } },
    { tag: "link", attrs: { rel: "manifest", href: "/manifest.webmanifest" } },
    { tag: "link", attrs: { rel: "stylesheet", href: "/src/styles.css" } },
    { tag: "meta", attrs: { name: "application-name", content: "Lasso" } },
    { tag: "meta", attrs: { name: "apple-mobile-web-app-title", content: "Lasso" } },
    { tag: "meta", attrs: { property: "og:image", content: "https://lasso.charlotte-labs.com/og-image.png" } },
    { tag: "meta", attrs: { name: "twitter:image", content: "https://lasso.charlotte-labs.com/og-image.png" } },
    { tag: "meta", attrs: { name: "description", content: "Lasso keeps the trace." } },
  ];

  it("hands Lasso the very same tags", () => {
    expect(brandHeadTags(head, "lasso")).toBe(head);
  });

  it("swaps every icon, the manifest, the app name and the preview image under Charlotte", () => {
    const out = brandHeadTags(head, "charlotte").map((tag) => tag.attrs?.["href"] ?? tag.attrs?.["content"]);
    expect(out).toEqual([
      "/charlotte-favicon.svg",
      "/charlotte-favicon-32.png",
      "/charlotte-apple-touch-icon.png",
      "/charlotte-manifest.webmanifest",
      "/src/styles.css",
      "Charlotte",
      "Charlotte",
      "https://lasso.charlotte-labs.com/charlotte-og-image.png",
      "https://lasso.charlotte-labs.com/charlotte-og-image.png",
      "Lasso keeps the trace.",
    ]);
  });

  it("names only files that exist in public/", async () => {
    const { existsSync } = await import("node:fs");
    for (const tag of brandHeadTags(head, "charlotte").slice(0, 4))
      expect(existsSync(`public${tag.attrs?.["href"]}`), String(tag.attrs?.["href"])).toBe(true);
    expect(existsSync("public/charlotte-og-image.png")).toBe(true);
  });
});
