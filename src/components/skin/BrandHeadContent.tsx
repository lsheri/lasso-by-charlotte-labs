import { Asset, useRouter, useTags } from "@tanstack/react-router";
import type { RouterManagedTag } from "@tanstack/router-core";
import { createElement } from "react";

import { brandFor, brandTitle } from "@/design/brand/brand";
import type { Skin } from "@/lib/skin";

/** Lasso's icon files and their Charlotte twins in public/ (Phase 4 PR12, drawn from the lapel tile). */
const CHARLOTTE_FILES: Record<string, string> = {
  "/favicon.svg": "/charlotte-favicon.svg",
  "/favicon-32.png": "/charlotte-favicon-32.png",
  "/apple-touch-icon.png": "/charlotte-apple-touch-icon.png",
  "/manifest.webmanifest": "/charlotte-manifest.webmanifest",
  "/og-image.png": "/charlotte-og-image.png",
};

/** The same address with a Lasso icon file swapped for its Charlotte twin; anything else comes back as it was. */
function charlotteFile(url: string): string {
  for (const [lasso, charlotte] of Object.entries(CHARLOTTE_FILES)) {
    if (url === lasso || url.endsWith(lasso)) return url.slice(0, url.length - lasso.length) + charlotte;
  }
  return url;
}

/** Meta tags that name the installed app. */
const APP_NAME_META = new Set(["apple-mobile-web-app-title", "application-name"]);
/** Meta tags that point at the link preview image. */
const IMAGE_META = new Set(["og:image", "twitter:image"]);

/**
 * The route head tags in this skin: the tab title, and under Charlotte its icons, manifest, app name and link preview
 * image. Lasso gets the very same array back.
 */
export function brandHeadTags(tags: RouterManagedTag[], skin: Skin): RouterManagedTag[] {
  if (skin === "lasso") return tags;
  const brand = brandFor(skin);
  return tags.map((tag) => {
    if (tag.tag === "title") return { ...tag, children: brandTitle(brand, tag.children) };
    const attrs = tag.attrs;
    if (tag.tag === "link" && typeof attrs?.["href"] === "string") {
      const href = charlotteFile(attrs["href"]);
      return href === attrs["href"] ? tag : { ...tag, attrs: { ...attrs, href } };
    }
    if (tag.tag === "meta" && typeof attrs?.["content"] === "string") {
      const key = attrs["name"] ?? attrs["property"];
      if (APP_NAME_META.has(key)) return { ...tag, attrs: { ...attrs, content: brand.name } };
      if (IMAGE_META.has(key)) return { ...tag, attrs: { ...attrs, content: charlotteFile(attrs["content"]) } };
    }
    return tag;
  });
}

/**
 * HeadContent, but the server writes the head in the skin it rendered with, so a Charlotte page never shows "Lasso" in
 * the tab before the app loads (Phase 4 PR11). Mirrors HeadContent from @tanstack/react-router.
 */
export function BrandHeadContent({ skin }: { skin: Skin }) {
  const tags = brandHeadTags(useTags(), skin);
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <>
      {tags.map((tag) => createElement(Asset, { ...tag, key: `tsr-meta-${JSON.stringify(tag)}`, ...(nonce ? { nonce } : {}) }))}
    </>
  );
}
