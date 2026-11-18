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
  /**
   * Which drawn assets the brand uses (18 Nov 2026, brand layer). Code asks the brand for its assets instead of
   * checking a skin's name, so a new brand picks from these sets, or adds its own beside them, in this one file.
   */
  look: BrandLook;
};

export type BrandLook = {
  /** The still and live mark: Lasso's loop, or Charlotte's C with its live hub. */
  mark: "loop" | "charlotte";
  /** GraphiteIcon's glyphs: the hand-drawn animated set, or the Exhibit set (stroke 1.5, still). */
  glyphs: "graphite" | "exhibit";
  /** Work-kind icons: Lucide, or the Exhibit kind glyphs. */
  kindIcons: "lucide" | "exhibit";
  /** The icon set src/design/brand/icons.tsx draws from. Lucide is the base set; a brand can add its own there. */
  icons: "lucide";
  /** The original default: no data-skin attribute on <html> and route heads left exactly as written. */
  legacyDefault: boolean;
};

export const BRANDS: Record<Skin, Brand> = {
  lasso: {
    name: "Lasso",
    wordmark: "LASSO",
    askLabel: "Ask Lasso",
    look: { mark: "loop", glyphs: "graphite", kindIcons: "lucide", icons: "lucide", legacyDefault: true },
  },
  charlotte: {
    name: "Charlotte",
    wordmark: "CHARLOTTE",
    askLabel: "Charlotte",
    look: { mark: "charlotte", glyphs: "exhibit", kindIcons: "exhibit", icons: "lucide", legacyDefault: false },
  },
};

export function brandFor(skin: Skin): Brand {
  return BRANDS[skin];
}

/**
 * The flip (Liam, 15 Nov 2026: "Build a flip switch, off"). While false, Lasso is the product everyone sees and
 * Charlotte is a skin for allowed accounts and preview links. Setting it true makes Charlotte the default skin for
 * everyone and renames what the server says on its own behalf: the connector's name and tool descriptions, its
 * replies to the AI, the sign-in client name, the email sender name and the site's default head. Icons, the share
 * image and the videos are files, swapped in the same PR as the flip.
 */
export const BRAND_FLIPPED = true;

/** The brand the server speaks as when no person's skin applies: Lasso until the flip, Charlotte after. */
export function launchBrand(flipped: boolean = BRAND_FLIPPED): Brand {
  return BRANDS[flipped ? "charlotte" : "lasso"];
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

/** brandCopy over every string in a fixed copy table (nested objects and arrays). Lasso returns the same table. */
export function brandCopyDeep<T>(brand: Brand, table: T): T {
  if (brand.name === "Lasso") return table;
  const walk = (value: unknown): unknown =>
    typeof value === "string"
      ? brandCopy(brand, value)
      : Array.isArray(value)
        ? value.map(walk)
        : value && typeof value === "object"
          ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v)]))
          : value;
  return walk(table) as T;
}

/** The maker's line: "Lasso by Charlotte Labs", or "Charlotte Labs" alone when the product shares the company's name. */
export function makerLine(brand: Brand): string {
  return brand.name === "Lasso" ? "Lasso by Charlotte Labs" : "Charlotte Labs";
}

// The app's own tab titles that name the product mid-sentence. They are matched whole, so a board titled "Why Lasso
// works" is never mistaken for one.
const FIXED_TITLES = new Set([
  "Why Lasso, the coach in your corner",
  "Lasso for students | Your work record, yours",
  "Icons · Lasso design system",
  "Lasso: the human judgment in your team's AI work, traced",
]);

/**
 * A route's tab title in the current skin. Only the product name at the start ("Lasso | ...") or end ("... | Lasso")
 * moves, or a whole title from the app's fixed list: the part before the bar can be a board or chat title, the
 * person's own words.
 */
export function brandTitle(brand: Brand, title: string): string {
  if (brand.name === "Lasso") return title;
  if (FIXED_TITLES.has(title)) return brandCopy(brand, title);
  return title.replace(/ \| Lasso$/, ` | ${brand.name}`).replace(/^Lasso \| /, `${brand.name} | `);
}
