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

// "Ask Lasso" names the panel and its control ("Close Ask Lasso", "Past Ask Lasso chats"), which under Charlotte is her
// name alone. When a verb phrase follows ("Ask Lasso about this section"), it stays an invitation: "Ask Charlotte about".
const ASK_AS_VERB = /Ask Lasso(?= (?:about|for|where|what|how|why|anything|a |the ))/g;

/**
 * A fixed product string in the current skin. Lasso returns it unchanged, so Lasso stays byte-identical. Only ever
 * pass the app's own copy: user content (chat titles, card text) can mention Lasso and must never be rewritten.
 */
export function brandCopy(brand: Brand, text: string): string {
  if (brand.name === "Lasso") return text;
  return text
    .replace(ASK_AS_VERB, `Ask ${brand.name}`)
    .replaceAll("Ask Lasso", brand.askLabel)
    .replaceAll("ASK LASSO", brand.askLabel.toUpperCase())
    .replaceAll("LASSO", brand.wordmark)
    .replaceAll("Lasso", brand.name);
}

/**
 * A route's tab title in the current skin. Only the product name at the start ("Lasso | ...") or end ("... | Lasso")
 * moves: the part before the bar can be a board or chat title, the person's own words.
 */
export function brandTitle(brand: Brand, title: string): string {
  if (brand.name === "Lasso") return title;
  return title.replace(/ \| Lasso$/, ` | ${brand.name}`).replace(/^Lasso \| /, `${brand.name} | `);
}
