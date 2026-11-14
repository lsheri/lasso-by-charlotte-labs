import { createContext, useContext } from "react";

import type { Skin } from "@/lib/skin";

export const SkinContext = createContext<Skin>("lasso");

/** The current brand skin. Lasso unless an allowed account turned Charlotte on. */
export function useSkin(): Skin {
  return useContext(SkinContext);
}
