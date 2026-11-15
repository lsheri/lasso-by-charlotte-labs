import { Asset, useRouter, useTags } from "@tanstack/react-router";
import type { RouterManagedTag } from "@tanstack/router-core";
import { createElement } from "react";

import { brandFor, brandTitle } from "@/design/brand/brand";
import type { Skin } from "@/lib/skin";

/** The route head tags with the tab title in this skin. Lasso gets the very same array back. */
export function brandHeadTags(tags: RouterManagedTag[], skin: Skin): RouterManagedTag[] {
  if (skin === "lasso") return tags;
  const brand = brandFor(skin);
  return tags.map((tag) => (tag.tag === "title" ? { ...tag, children: brandTitle(brand, tag.children) } : tag));
}

/**
 * HeadContent, but the server writes the tab title in the skin it rendered with, so a Charlotte page never shows
 * "Lasso" in the tab before the app loads (Phase 4 PR11). Mirrors HeadContent from @tanstack/react-router.
 */
export function BrandHeadContent({ skin }: { skin: Skin }) {
  const tags = brandHeadTags(useTags(), skin);
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <>
      {tags.map((tag) => createElement(Asset, { ...tag, key: `tsr-meta-${JSON.stringify(tag)}`, nonce }))}
    </>
  );
}
