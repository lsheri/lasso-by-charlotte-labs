// Phase 4 PR4: which brand the AI speaks as, decided on the server. The skin cookie only counts for an allowed
// account (D1), the same rule the page uses, so a plain cookie cannot make the model call itself Charlotte.
import { brandFor, type Brand } from "@/design/brand/brand";
import { SKIN_COOKIE, parseSkin, resolveSkin, type Skin } from "@/lib/skin";

/** The skin cookie from a raw Cookie header (plain HTTP routes, which have no server-function cookie helper). */
export function skinFromCookieHeader(header: string | null | undefined): Skin {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === SKIN_COOKIE) return parseSkin(decodeURIComponent(rest.join("=")));
  }
  return "lasso";
}

/** The brand for one request: the cookie's skin, honoured only for an allowed email. Lasso otherwise. */
export function serverBrand(cookieSkin: Skin, email: string | null | undefined): Brand {
  return brandFor(resolveSkin({ current: cookieSkin, requested: null, email }));
}
