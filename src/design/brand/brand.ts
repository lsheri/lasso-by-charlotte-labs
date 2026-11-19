// Phase 4: one brand per skin, all or nothing (Liam, 15 Nov 2026). Charlotte shows no Lasso name or mark anywhere,
// and Lasso shows no Charlotte. Every name, wordmark and Ask label a surface shows reads from here, so the rename
// lives in one file. Code names (lasso_* tools, --lasso-* tokens, data-lasso, events) never change.
import { DEFAULT_BRAND_VARIANT, type BrandVariant } from "@/lib/brand-variant-shared";
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
  /** The still and live mark: Lasso's loop, Charlotte's C with its live hub, or the Spool script's thread. */
  mark: "loop" | "charlotte" | "spool";
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

/**
 * Slate / Spool script (19 Nov 2026). Liam, 19 Nov: under this look the product is called Lasso everywhere, in every
 * sentence, tab title, email, the AI connector and the icons; under the current look it stays Charlotte. So the look
 * carries a whole brand, never a part of one: name, wordmark, Ask label and mark change together and cannot disagree.
 * The drawn glyph sets stay the skin's. The colours are the [data-brand-theme="slate-spool"] scope in tokens.css.
 */
const SLATE_SPOOL: Pick<Brand, "name" | "wordmark" | "askLabel"> & { mark: BrandLook["mark"] } = {
  name: "Lasso",
  wordmark: "LASSO",
  askLabel: "Ask Lasso",
  mark: "spool",
};

/**
 * THE ONE SOURCE for the product's name. Every surface asks here: React through useBrand() and useBrandCopy()
 * (src/components/skin/use-skin.ts), the server through launchBrand() or serverBrand(). The brand is the skin's, in
 * the given variant. The variant never applies to the original Lasso skin, which stays exactly as it was.
 */
export function brandFor(skin: Skin, variant: BrandVariant = "current"): Brand {
  const brand = BRANDS[skin];
  if (variant !== "slate-spool" || brand.look.legacyDefault) return brand;
  return {
    name: SLATE_SPOOL.name,
    wordmark: SLATE_SPOOL.wordmark,
    askLabel: SLATE_SPOOL.askLabel,
    look: { ...brand.look, mark: SLATE_SPOOL.mark },
  };
}

/**
 * The flip (Liam, 15 Nov 2026: "Build a flip switch, off"). While false, Lasso is the product everyone sees and
 * Charlotte is a skin for allowed accounts and preview links. Setting it true makes Charlotte the default skin for
 * everyone and renames what the server says on its own behalf: the connector's name and tool descriptions, its
 * replies to the AI, the sign-in client name, the email sender name and the site's default head. Icons, the share
 * image and the videos are files, swapped in the same PR as the flip.
 */
export const BRAND_FLIPPED = true;

/**
 * The brand the server speaks as when no person's choice applies (emails, the AI connector, the default head): the
 * launch skin in the default variant. So the one line in brand-variant-shared.ts that makes Slate / Spool script the
 * default also renames what the server says, and the two can never disagree.
 */
export function launchBrand(flipped: boolean = BRAND_FLIPPED, variant: BrandVariant = DEFAULT_BRAND_VARIANT): Brand {
  return brandFor(flipped ? "charlotte" : "lasso", variant);
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
    // The name in capitals, not the lockup's wordmark, so sentence copy always follows the name.
    .replaceAll("LASSO", brand.name.toUpperCase())
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

/**
 * A tab title already written for one brand, in another: used when the look changes after the page loaded, when the
 * title in the tab is no longer the route's own "... | Lasso".
 */
export function rebrandTitle(from: Brand, to: Brand, title: string): string {
  let plain = title;
  if (from.name !== "Lasso") {
    const fixed = [...FIXED_TITLES].find((t) => brandCopy(from, t) === title);
    plain =
      fixed ??
      (title.endsWith(` | ${from.name}`)
        ? `${title.slice(0, -from.name.length)}Lasso`
        : title.startsWith(`${from.name} | `)
          ? `Lasso${title.slice(from.name.length)}`
          : title);
  }
  return brandTitle(to, plain);
}

// The icon files each brand mark uses. Route heads and the AI connector name Lasso's files; a brand with its own mark
// swaps in its twins from public/.
/** Lasso's icon files and their Charlotte twins in public/ (Phase 4 PR12, drawn from the lapel tile). */
const CHARLOTTE_FILES: Record<string, string> = {
  "/favicon.svg": "/charlotte-favicon.svg",
  "/favicon-32.png": "/charlotte-favicon-32.png",
  "/apple-touch-icon.png": "/charlotte-apple-touch-icon.png",
  "/manifest.webmanifest": "/charlotte-manifest.webmanifest",
  "/og-image.png": "/charlotte-og-image.png",
};

/** The Spool script twins (19 Nov 2026): the spool at rest on a Slate cloth tile. */
const SPOOL_FILES: Record<string, string> = {
  "/favicon.svg": "/slate-favicon.svg",
  "/favicon-32.png": "/slate-favicon-32.png",
  "/apple-touch-icon.png": "/slate-apple-touch-icon.png",
  "/manifest.webmanifest": "/slate-manifest.webmanifest",
  "/og-image.png": "/slate-og-image.png",
};

/** Each mark's icon files. The loop's are the route heads' own, so it needs no swap. */
const FILES_BY_MARK: Record<BrandLook["mark"], Record<string, string>> = {
  loop: {},
  charlotte: CHARLOTTE_FILES,
  spool: SPOOL_FILES,
};

/** The same address with a Lasso icon file swapped for the brand's twin; anything else comes back as it was. */
export function brandFile(url: string, mark: BrandLook["mark"]): string {
  for (const [lasso, twin] of Object.entries(FILES_BY_MARK[mark])) {
    if (url === lasso || url.endsWith(lasso)) return url.slice(0, url.length - lasso.length) + twin;
  }
  return url;
}

/** The browser chrome colour the route head writes, and the one each mark's ground asks for instead. */
const HEAD_THEME_COLOR = "#fafaf8";
const THEME_COLOR_BY_MARK: Partial<Record<BrandLook["mark"], string>> = { spool: "#eceef0" };

/** The head's theme-color in this brand; any other colour a route sets comes back as it was. */
export function brandThemeColor(color: string, mark: BrandLook["mark"]): string {
  return color === HEAD_THEME_COLOR ? (THEME_COLOR_BY_MARK[mark] ?? color) : color;
}
