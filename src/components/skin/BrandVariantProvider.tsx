import { useEffect, useState, type ReactNode } from "react";

import { useSession } from "@/hooks/use-session";
import { readBrandVariantChoice, writeBrandVariantCookie } from "@/lib/brand-variant";
import {
  resolveBrandVariant,
  variantFromBrandParam,
  type BrandVariant,
} from "@/lib/brand-variant-shared";

import { BrandVariantContext } from "./use-skin";

/**
 * Holds the brand variant the server rendered with (the saved choice, else the default), then checks it once the
 * session is known, the way SkinProvider checks the skin: `?brand=slate-spool` asks for Slate / Spool script, and only
 * an allowed account or a preview host keeps a choice. A change writes the cookie and `data-brand-theme` on <html>;
 * the app as it ships carries no attribute.
 */
export function BrandVariantProvider({
  initial,
  children,
}: {
  initial: BrandVariant;
  children: ReactNode;
}) {
  const [variant, setVariant] = useState<BrandVariant>(initial);
  const { session, loading } = useSession();
  const email = session?.user.email;

  useEffect(() => {
    if (loading) return;
    const next = resolveBrandVariant({
      stored: readBrandVariantChoice(),
      requested: variantFromBrandParam(window.location.search),
      email,
      host: window.location.hostname,
    });
    writeBrandVariantCookie(next);
    // The original Lasso skin sets no data-skin, and the theme's tokens need one, so the attribute is harmless there.
    if (next === "current") document.documentElement.removeAttribute("data-brand-theme");
    else document.documentElement.setAttribute("data-brand-theme", next);
    if (next !== variant) setVariant(next);
  }, [loading, email, variant]);

  return <BrandVariantContext.Provider value={variant}>{children}</BrandVariantContext.Provider>;
}
