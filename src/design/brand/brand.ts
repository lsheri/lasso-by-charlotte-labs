// Phase 4: one brand per skin, all or nothing (Liam, 15 Nov 2026). Charlotte shows no Lasso name or mark anywhere,
// and Lasso shows no Charlotte. Every name, wordmark and Ask label a surface shows reads from here, so the rename
// lives in one file. Code names (lasso_* tools, --lasso-* tokens, data-lasso, events) never change.
import type { Skin } from "@/lib/skin";

export type Brand = {
  /** The product's name in a sentence: "Lasso is reading", "Charlotte is reading". */
  name: string;
  /** The spaced capitals beside the mark in a lockup. */
  wordmark: string;
  /** The label on the Ask control. Under Charlotte the name alone is the invitation. */
  askLabel: string;
};

export const BRANDS: Record<Skin, Brand> = {
  lasso: { name: "Lasso", wordmark: "LASSO", askLabel: "Ask Lasso" },
  charlotte: { name: "Charlotte", wordmark: "CHARLOTTE", askLabel: "Charlotte" },
};

export function brandFor(skin: Skin): Brand {
  return BRANDS[skin];
}
