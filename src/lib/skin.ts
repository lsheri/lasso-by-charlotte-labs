import { createIsomorphicFn } from "@tanstack/react-start";
import { getCookie } from "@tanstack/react-start/server";

/**
 * The brand skin. Lasso is the default and the only skin users see. Charlotte is the second brand, built
 * behind this switch, and turned on only by an allowed account until the default flip (P5).
 * Only `data-skin` on <html> changes; every skin's CSS keys off it.
 */
export type Skin = "lasso" | "charlotte";

export const SKIN_COOKIE = "skin";
const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function parseSkin(value: string | null | undefined): Skin {
  return value === "charlotte" ? "charlotte" : "lasso";
}

/** `?brand=charlotte` asks for Charlotte, `?brand=lasso` for Lasso; anything else asks for nothing. */
export function skinFromBrandParam(search: string): Skin | null {
  const brand = new URLSearchParams(search).get("brand");
  return brand === "charlotte" || brand === "lasso" ? brand : null;
}

/**
 * Who may turn Charlotte on before launch: QA accounts and the Charlotte Labs team, so a shared link
 * cannot show a half-built skin to anyone else. Domains, not addresses, so no one's email is in the code.
 */
export function canUseCharlotte(email: string | null | undefined): boolean {
  const domain = email?.toLowerCase().split("@")[1];
  return domain === "qaprobe.test" || domain === "charlotte-labs.com";
}

/**
 * The skin this page should show, given what was asked for and who is signed in. `null` means the session
 * is still loading, so nothing changes yet. A Charlotte cookie without an allowed account falls back to Lasso.
 */
export function resolveSkin({
  current,
  requested,
  email,
}: {
  current: Skin;
  requested: Skin | null;
  email: string | null | undefined;
}): Skin {
  if (requested === "lasso") return "lasso";
  if (!canUseCharlotte(email)) return "lasso";
  return requested ?? current;
}

function cookieValue(cookies: string, name: string): string | undefined {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

/** The skin cookie, read on the server during render and from document.cookie in the browser. */
export const readSkinCookie = createIsomorphicFn()
  .server((): Skin => {
    try {
      return parseSkin(getCookie(SKIN_COOKIE));
    } catch {
      return "lasso";
    }
  })
  .client((): Skin => parseSkin(cookieValue(document.cookie, SKIN_COOKIE)));

/** Browser only. Lasso clears the cookie, so the default leaves nothing behind. */
export function writeSkinCookie(skin: Skin): void {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie =
    skin === "charlotte"
      ? `${SKIN_COOKIE}=charlotte; Path=/; Max-Age=${ONE_YEAR_S}; SameSite=Lax${secure}`
      : `${SKIN_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
