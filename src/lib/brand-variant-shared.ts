/**
 * The brand variant: a second look worn over the current skin, chosen in this one file (19 Nov 2026, brand
 * exploration). "current" is the app as it ships. "slate-spool" is Slate cloth with the Spool script mark and the
 * LASSO wordmark. Only `data-brand-theme` on <html> changes; the tokens live in src/design/tokens.css.
 *
 * Pure rules only, so they can be tested without a browser or a server.
 */
import { canUseCharlotte, isPreviewHost } from "@/lib/skin";

export type BrandVariant = "current" | "slate-spool";

/** The one line that decides what everyone sees. Change it to "slate-spool" to make Slate / Spool script the default. */
export const DEFAULT_BRAND_VARIANT: BrandVariant = "slate-spool";

export const BRAND_VARIANT_COOKIE = "brand_variant";

/** A stored or requested value. Anything unknown means "no choice made", which is null. */
export function parseBrandVariant(value: string | null | undefined): BrandVariant | null {
  return value === "slate-spool" || value === "current" ? value : null;
}

/**
 * `?brand=slate-spool` asks for the new look. `?brand=charlotte` and `?brand=current` ask for the app as it ships,
 * so the same link that picks a skin also leaves the variant. Anything else asks for nothing.
 */
export function variantFromBrandParam(search: string): BrandVariant | null {
  const brand = new URLSearchParams(search).get("brand");
  if (brand === "slate-spool") return "slate-spool";
  return brand === "charlotte" || brand === "current" ? "current" : null;
}

/**
 * The variant this page should show. Only the people who could preview Charlotte before its launch may leave the
 * default (QA accounts, the Charlotte Labs team, and signed-out visitors on this machine or a Lovable preview), so a
 * shared link or a hand-set cookie never shows an unfinished look to anyone else.
 */
export function resolveBrandVariant({
  stored,
  requested,
  email,
  host,
  fallback = DEFAULT_BRAND_VARIANT,
}: {
  /** The choice already saved for this browser, if any. */
  stored: BrandVariant | null;
  requested: BrandVariant | null;
  email: string | null | undefined;
  host?: string | null | undefined;
  fallback?: BrandVariant;
}): BrandVariant {
  const allowed = canUseCharlotte(email) || (!email && isPreviewHost(host));
  if (!allowed) return fallback;
  return requested ?? stored ?? fallback;
}
