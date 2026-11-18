/**
 * Design health: the counts that decide how cheap the next reskin is.
 * design-health.test.ts measures them and fails if any number rises above
 * design-health.json. When a number falls, lower it in the JSON in the same
 * change, so the gain is locked in. Counting rules are fixed; do not loosen them.
 *
 * Scope: src/**\/*.{ts,tsx,css}, excluding tests, src/design/** (token and
 * reference source), src/components/marketing/** and any /archive/ path.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

export type HealthCounts = {
  /** Tailwind text-[Npx] and CSS font-size: Npx not read from a token. */
  rawFontSize: number;
  /** Tailwind rounded-[<length>] and CSS border-radius: Npx. rounded-[var(--x)] reads a token and is not counted. */
  rawRadius: number;
  /** #rrggbb or #rgb colour literals in TS and TSX. */
  hexInComponents: number;
  /** var(--nb-*) uses outside the token files. Custom-property declarations (token plumbing) are not counted. */
  legacyNbReads: number;
  /** z-index: N in CSS and z-[N] in TSX. */
  literalZIndex: number;
  /** !important in CSS. */
  importantRules: number;
  /** Raw <select> in TSX outside src/components/ui. Use NativeSelect or Select. */
  nativeSelect: number;
  /** Class strings outside src/components/ui that build a mono pill by hand (rounded-full + font-mono + uppercase). Use chipVariants or tagVariants. */
  handPills: number;
  /** Files importing lucide-react. The second icon set; GraphiteIcon is the house set. */
  lucideFiles: number;
};

const EXCLUDE = [
  /__tests__/,
  /\.test\.tsx?$/,
  /\.stories\.tsx?$/,
  /^src\/design\//,
  /^src\/components\/marketing\//,
  /\/archive\//,
  /routeTree\.gen\.ts$/,
];

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.(tsx?|css)$/.test(name) && !EXCLUDE.some((re) => re.test(full))) out.push(full);
  }
  return out;
}

const count = (text: string, re: RegExp) => text.match(re)?.length ?? 0;

export function measure(root = "src"): HealthCounts {
  const c: HealthCounts = {
    rawFontSize: 0,
    rawRadius: 0,
    hexInComponents: 0,
    legacyNbReads: 0,
    literalZIndex: 0,
    importantRules: 0,
    nativeSelect: 0,
    handPills: 0,
    lucideFiles: 0,
  };
  for (const file of files(root)) {
    const text = readFileSync(file, "utf8");
    const css = file.endsWith(".css");
    c.rawFontSize += count(text, css ? /font-size:\s*[0-9.]+px/g : /\btext-\[[0-9.]+px\]/g);
    c.rawRadius += count(
      text,
      css ? /border-radius:\s*[0-9.]+px/g : /\brounded(?:-[a-z]{1,2})?-\[[0-9.]+(?:px|rem|em|%)/g,
    );
    if (!css)
      c.hexInComponents += count(text, /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![0-9a-fA-F])/g);
    // A custom-property declaration that points at an --nb-* name is token plumbing, not a use; only uses count.
    const uses = css ? text.replace(/(^|[;{\s])--[a-z0-9-]+\s*:[^;{}]*;/g, "$1") : text;
    c.legacyNbReads += count(uses, /var\(--nb-[a-z0-9-]+/g);
    c.literalZIndex += count(text, css ? /z-index:\s*-?\d+/g : /\bz-\[-?\d+\]/g);
    if (css) c.importantRules += count(text, /!important/g);
    if (!css) {
      const primitive = /src\/components\/ui\//.test(file.split(path.sep).join("/"));
      if (!primitive) {
        c.nativeSelect += count(text, /<select\b/g);
        c.handPills += (text.match(/["'`][^"'`\n]*\brounded-full\b[^"'`\n]*["'`]/g) ?? []).filter(
          (literal) => /\bfont-mono\b/.test(literal) && /\buppercase\b/.test(literal),
        ).length;
      }
      if (/from\s+["']lucide-react["']/.test(text)) c.lucideFiles += 1;
    }
  }
  return c;
}
