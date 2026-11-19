import { Asset, useRouter, useTags } from "@tanstack/react-router";
import type { RouterManagedTag } from "@tanstack/router-core";
import { createElement } from "react";

import { brandCopy, brandFile, brandFor, brandThemeColor, launchBrand, rebrandTitle } from "@/design/brand/brand";
import type { BrandVariant } from "@/lib/brand-variant-shared";
import type { Skin } from "@/lib/skin";

/** Meta tags that name the installed app. */
const APP_NAME_META = new Set(["apple-mobile-web-app-title", "application-name"]);
/** Meta tags that repeat the page title on a link preview card. */
const TITLE_META = new Set(["og:title", "twitter:title"]);
/** Meta tags that describe the page, in a search result or on a link preview card. */
const DESCRIPTION_META = new Set(["description", "og:description", "twitter:description"]);
/** Meta tags that point at the link preview image. */
const IMAGE_META = new Set(["og:image", "twitter:image"]);

/**
 * The route head tags in this skin: the tab title, and under Charlotte its icons, manifest, app name and link preview
 * image. Lasso gets the very same array back.
 */
export function brandHeadTags(
  tags: RouterManagedTag[],
  skin: Skin,
  variant: BrandVariant = "current",
): RouterManagedTag[] {
  const brand = brandFor(skin, variant);
  if (brand.look.legacyDefault) return tags;
  const mark = brand.look.mark;
  const launch = launchBrand();
  return tags.map((tag) => {
    // Routes write "... | Lasso"; the root's default head is already in the launch brand. Both end in this brand.
    if (tag.tag === "title") return { ...tag, children: rebrandTitle(launch, brand, tag.children) };
    const attrs = tag.attrs;
    if (tag.tag === "link" && typeof attrs?.["href"] === "string") {
      const href = brandFile(attrs["href"], mark);
      return href === attrs["href"] ? tag : { ...tag, attrs: { ...attrs, href } };
    }
    if (tag.tag === "meta" && typeof attrs?.["content"] === "string") {
      const key = attrs["name"] ?? attrs["property"];
      if (APP_NAME_META.has(key)) return { ...tag, attrs: { ...attrs, content: brand.name } };
      if (IMAGE_META.has(key)) return { ...tag, attrs: { ...attrs, content: brandFile(attrs["content"], mark) } };
      // The card title follows the tab title: a route's own "... | Lasso" or the root's default in the launch brand.
      if (TITLE_META.has(key)) {
        const content = rebrandTitle(launch, brand, attrs["content"]);
        return content === attrs["content"] ? tag : { ...tag, attrs: { ...attrs, content } };
      }
      // Route descriptions are the app's own fixed copy, written as Lasso, so they take the name like any sentence.
      if (DESCRIPTION_META.has(key)) {
        const content = brandCopy(brand, attrs["content"]);
        return content === attrs["content"] ? tag : { ...tag, attrs: { ...attrs, content } };
      }
      if (key === "theme-color") {
        const content = brandThemeColor(attrs["content"], mark);
        return content === attrs["content"] ? tag : { ...tag, attrs: { ...attrs, content } };
      }
    }
    return tag;
  });
}

/**
 * HeadContent, but the server writes the head in the skin it rendered with, so a Charlotte page never shows "Lasso" in
 * the tab before the app loads (Phase 4 PR11). Mirrors HeadContent from @tanstack/react-router.
 */
export function BrandHeadContent({ skin, variant = "current" }: { skin: Skin; variant?: BrandVariant }) {
  const tags = brandHeadTags(useTags(), skin, variant);
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <>
      {tags.map((tag) => createElement(Asset, { ...tag, key: `tsr-meta-${JSON.stringify(tag)}`, ...(nonce ? { nonce } : {}) }))}
    </>
  );
}
