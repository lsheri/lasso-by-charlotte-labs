import { useEffect, useState, type ReactNode } from "react";

import { useSession } from "@/hooks/use-session";
import { brandFor, brandTitle } from "@/design/brand/brand";

import { SkinContext } from "./use-skin";
import { resolveSkin, skinFromBrandParam, writeSkinCookie, type Skin } from "@/lib/skin";

/**
 * Holds the skin the server rendered with, then checks it once the session is known: `?brand=` asks for a
 * skin, and only an allowed account keeps Charlotte. A change writes the cookie and `data-skin` on <html>.
 */
export function SkinProvider({ initial, children }: { initial: Skin; children: ReactNode }) {
  const [skin, setSkin] = useState<Skin>(initial);
  const { session, loading } = useSession();
  const email = session?.user.email;

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
    const brand = brandFor(skin);
    if (brand.look.legacyDefault) return;
    const rename = () => {
      const next = brandTitle(brand, document.title);
      if (next !== document.title) document.title = next;
    };
    rename();
    const observer = new MutationObserver(rename);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [skin]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}
