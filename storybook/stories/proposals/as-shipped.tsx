import { useEffect, type ReactNode } from "react";

import { BrandVariantContext, SkinContext } from "@/components/skin/use-skin";

/** The look everyone gets today: the launched skin wearing Slate / Spool script, as the root route sets it. */
export function AsShipped({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset["brandTheme"] = "slate-spool";
    document.body.dataset["lasso"] = "on";
    return () => {
      delete html.dataset["brandTheme"];
      delete document.body.dataset["lasso"];
    };
  }, []);
  return (
    <SkinContext.Provider value="charlotte">
      <BrandVariantContext.Provider value="slate-spool">{children}</BrandVariantContext.Provider>
    </SkinContext.Provider>
  );
}
