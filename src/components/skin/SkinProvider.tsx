import { useEffect, useState, type ReactNode } from "react";

import { useSession } from "@/hooks/use-session";
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
    });
    if (next === skin) return;
    writeSkinCookie(next);
    if (next === "lasso") document.documentElement.removeAttribute("data-skin");
    else document.documentElement.setAttribute("data-skin", next);
    setSkin(next);
  }, [loading, email, skin]);

  return <SkinContext.Provider value={skin}>{children}</SkinContext.Provider>;
}
