// Resolves a skin's custom properties as the browser would on the app shell: skin-base.css first, then the skin,
// with var() and srgb color-mix() worked out to hex. Tests use it to check contrast on the values a skin really shows.
import { readFileSync } from "node:fs";

function declarations(css: string): Array<[string, string]> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  return [...text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map((m) => [
    m[1] ?? "",
    (m[2] ?? "").trim(),
  ]);
}

const hex2 = (n: number) => Math.round(n).toString(16).padStart(2, "0");

function mix(a: string, pct: number, b: string): string {
  const ch = (h: string, i: number) => parseInt(h.slice(i, i + 2), 16);
  const w = pct / 100;
  return `#${[1, 3, 5].map((i) => hex2(ch(a, i) * w + ch(b, i) * (1 - w))).join("")}`;
}

/** Every custom property the skin's shell block ends up with, keyed by name. Later declarations win. */
export function resolvedSkin(skin: string): Map<string, string> {
  const raw = new Map<string, string>();
  const base = readFileSync("src/design/skins/skin-base.css", "utf8");
  const own = readFileSync(`src/design/skins/${skin}.css`, "utf8");
  // Only the first block of each file holds the shell's values; later blocks are scoped rules.
  for (const css of [base, own])
    for (const [k, v] of declarations(css.slice(0, css.indexOf("}")))) raw.set(k, v);
  const resolve = (value: string, depth = 0): string => {
    if (depth > 8) return value;
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (ref) {
      const next = raw.get(ref[1] ?? "");
      return next === undefined ? value : resolve(next, depth + 1);
    }
    const m =
      /^color-mix\(in srgb, var\((--[a-z0-9-]+)\) ([0-9.]+)%, var\((--[a-z0-9-]+)\)\)$/.exec(value);
    if (m) {
      const [a, b] = [resolve(`var(${m[1]})`, depth + 1), resolve(`var(${m[3]})`, depth + 1)];
      if (/^#[0-9a-f]{6}$/i.test(a) && /^#[0-9a-f]{6}$/i.test(b)) return mix(a, Number(m[2]), b);
    }
    return value;
  };
  return new Map([...raw].map(([k, v]) => [k, resolve(v)]));
}
