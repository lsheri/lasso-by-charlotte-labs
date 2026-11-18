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
  /** var(--nb-*) reads outside the token files. */
  legacyNbReads: number;
  /** z-index: N in CSS and z-[N] in TSX. */
  literalZIndex: number;
  /** !important in CSS. */
  importantRules: number;
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
    c.legacyNbReads += count(text, /var\(--nb-[a-z0-9-]+/g);
    c.literalZIndex += count(text, css ? /z-index:\s*-?\d+/g : /\bz-\[-?\d+\]/g);
    if (css) c.importantRules += count(text, /!important/g);
  }
  return c;
}
