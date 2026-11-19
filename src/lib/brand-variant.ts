import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

import {
  BRAND_VARIANT_COOKIE,
  DEFAULT_BRAND_VARIANT,
  parseBrandVariant,
  type BrandVariant,
} from "@/lib/brand-variant-shared";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

function cookieValue(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The saved choice, or null when this browser never made one. Read on the server during render and in the browser. */
export const readBrandVariantChoice = createIsomorphicFn()
  .server((): BrandVariant | null => {
    try {
      return parseBrandVariant(getCookie(BRAND_VARIANT_COOKIE));
    } catch {
      return null;
    }
  })
  .client((): BrandVariant | null =>
    parseBrandVariant(cookieValue(document.cookie, BRAND_VARIANT_COOKIE)),
  );

/** The variant to render first: the saved choice, else the default. SkinProvider checks it once the session is known. */
export function readBrandVariant(): BrandVariant {
  return readBrandVariantChoice() ?? DEFAULT_BRAND_VARIANT;
}

/** Browser only. The default clears the cookie, so the app as it ships leaves nothing behind. */
export function writeBrandVariantCookie(variant: BrandVariant): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    variant === DEFAULT_BRAND_VARIANT
      ? `${BRAND_VARIANT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
      : `${BRAND_VARIANT_COOKIE}=${variant}; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax${secure}`;
}
