// Phase 4 PR4: which brand the AI speaks as, decided on the server. The skin cookie only counts for an allowed
// account (D1), the same rule the page uses, so a plain cookie cannot make the model call itself Charlotte.
import { brandFor, type Brand } from "@/design/brand/brand";
import {
  BRAND_VARIANT_COOKIE,
  parseBrandVariant,
  resolveBrandVariant,
  type BrandVariant,
} from "@/lib/brand-variant-shared";
import { SKIN_COOKIE, parseSkin, resolveSkin, type Skin } from "@/lib/skin";

function cookieFromHeader(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The saved brand variant from a raw Cookie header, or null when this browser never chose one. */
export function variantFromCookieHeader(header: string | null | undefined): BrandVariant | null {
  return parseBrandVariant(cookieFromHeader(header, BRAND_VARIANT_COOKIE));
}

/** The skin cookie from a raw Cookie header (plain HTTP routes, which have no server-function cookie helper). */
export function skinFromCookieHeader(header: string | null | undefined): Skin {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SKIN_COOKIE) return parseSkin(decodeURIComponent(rest.join("=")));
  }
  return "lasso";
}

/**
 * The brand for one request: the cookie's skin and variant, each honoured only for an allowed email, so the AI names
 * the product the way the page around it does. Anyone else gets the launch skin in the default variant.
 */
export function serverBrand(
  cookieSkin: Skin,
  email: string | null | undefined,
  cookieVariant: BrandVariant | null = null,
): Brand {
  return brandFor(
    resolveSkin({ current: cookieSkin, requested: null, email }),
    resolveBrandVariant({ stored: cookieVariant, requested: null, email }),
  );
}
