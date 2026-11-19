import { useEffect, useRef, useState, type ReactNode } from "react";

import { useSession } from "@/hooks/use-session";
import { brandFor, launchBrand, rebrandTitle, type Brand } from "@/design/brand/brand";

import { SkinContext, useBrandVariant } from "./use-skin";
import { resolveSkin, skinFromBrandParam, writeSkinCookie, type Skin } from "@/lib/skin";

/**
 * Holds the skin the server rendered with, then checks it once the session is known: `?brand=` asks for a
 * skin, and only an allowed account keeps Charlotte. A change writes the cookie and `data-skin` on <html>.
 */
export function SkinProvider({ initial, children }: { initial: Skin; children: ReactNode }) {
  const [skin, setSkin] = useState<Skin>(initial);
  const { session, loading } = useSession();
  const email = session?.user.email;
  // The variant provider sits outside this one, so the tab title follows the look as well as the skin.
  const variant = useBrandVariant();
  const titledAs = useRef<Brand | null>(null);

  useEffect(() => {
    if (loading) return;
    const next = resolveSkin({
      current: skin,
      requested: skinFromBrandParam(window.location.search),
      email,
      host: window.location.hostname,
    });
    if (next === skin) return;
    writeSkinCookie(next);
    if (brandFor(next).look.legacyDefault) document.documentElement.removeAttribute("data-skin");
    else document.documentElement.setAttribute("data-skin", next);
    setSkin(next);
  }, [loading, email, skin]);

  // Phase 4: route heads write "... | Lasso" without knowing the skin. BrandHeadContent renames the first title on the
  // server (PR11); this catches a skin chosen after load, renaming each time the router sets it. Lasso never observes anything.
  useEffect(() => {
    const brand = brandFor(skin, variant);
    if (brand.look.legacyDefault) return;
    // A title in the tab can be the route's own ("... | Lasso"), the root's default (the launch brand's), or one this
    // effect already renamed for the look before a change. Each becomes this brand's.
    const earlier = [titledAs.current, launchBrand()].filter((from): from is Brand => from !== null);
    titledAs.current = brand;
    const rename = () => {
      const next = earlier.reduce((title, from) => rebrandTitle(from, brand, title), document.title);
      if (next !== document.title) document.title = next;
    };
    rename();
    const observer = new MutationObserver(rename);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [skin, variant]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}
