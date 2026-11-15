import { createContext, useContext } from "react";

import { brandFor, type Brand } from "@/design/brand/brand";
import type { Skin } from "@/lib/skin";

export const SkinContext = createContext<Skin>("lasso");

/** The current brand skin. Lasso unless an allowed account turned Charlotte on. */
export function useSkin(): Skin {
  return useContext(SkinContext);
}

/** The current skin's name, wordmark and Ask label (Phase 4). */
export function useBrand(): Brand {
  return brandFor(useSkin());
}
