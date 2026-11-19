import { createContext, useContext } from "react";

import { brandCopy, brandFor, type Brand } from "@/design/brand/brand";
import { DEFAULT_BRAND_VARIANT, type BrandVariant } from "@/lib/brand-variant-shared";
import type { Skin } from "@/lib/skin";

export const SkinContext = createContext<Skin>("lasso");
/** The brand variant worn over the skin (see src/lib/brand-variant-shared.ts). */
export const BrandVariantContext = createContext<BrandVariant>(DEFAULT_BRAND_VARIANT);

/** The current brand skin. Lasso unless an allowed account turned Charlotte on. */
export function useSkin(): Skin {
  return useContext(SkinContext);
}

/** The current brand variant: the app as it ships, or Slate / Spool script. */
export function useBrandVariant(): BrandVariant {
  return useContext(BrandVariantContext);
}

/** The current skin's name, wordmark, Ask label and marks (Phase 4), in the current variant. */
export function useBrand(): Brand {
  return brandFor(useSkin(), useBrandVariant());
}

/** Rewrites the app's own copy for the current skin: `const copy = useBrandCopy(); copy("Ask Lasso")`. Never user content. */
export function useBrandCopy(): (text: string) => string {
  const brand = useBrand();
  return (text) => brandCopy(brand, text);
}
