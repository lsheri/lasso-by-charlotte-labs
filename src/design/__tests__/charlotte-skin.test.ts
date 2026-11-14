// P2a: Charlotte colours pass contrast, keep lime off focus, text and state, and stay out of the app until PR2.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/design/skins/charlotte.css", "utf8");

/** Every --name:value in the Charlotte block, with var(--x) resolved inside the block. */
function tokens(): Map<string, string> {
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
    raw.set(m[1] ?? "", (m[2] ?? "").trim());
  const resolve = (value: string, depth = 0): string => {
    const ref = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (!ref || depth > 5) return value;
    const next = raw.get(ref[1] ?? "");
    return next === undefined ? value : resolve(next, depth + 1);
  };
  return new Map([...raw].map(([k, v]) => [k, resolve(v)]));
}

function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

const t = tokens();
const v = (name: string) => {
  const value = t.get(name);
  expect(value, name).toMatch(/^#[0-9a-fA-F]{6}$/);
  return value ?? "";
};
const SURFACES = ["--surface-page", "--surface-raised", "--surface-sunk"];

describe("Charlotte skin", () => {
  it("overrides on the app shell, one attribute stronger than the [data-lasso] remaps", () => {
    expect(css).toContain('[data-skin="charlotte"] [data-lasso="on"] {');
  });

  it("keeps body text at 4.5:1 or better on every surface", () => {
    for (const surface of SURFACES) {
      for (const text of ["--text-primary", "--text-secondary"]) {
        expect(contrast(v(text), v(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("keeps muted text, focus rings and state marks at 3:1 or better on every surface", () => {
    for (const surface of SURFACES) {
      for (const mark of [
        "--text-muted",
        "--focus-ring",
        "--focus-ring-new",
        "--hand-ink",
        "--state-on-record",
        "--wrap-mark",
        "--icon-ink-active",
        "--state-highlight",
      ]) {
        expect(contrast(v(mark), v(surface)), `${mark} on ${surface}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the held tool's glyph readable on its fill", () => {
    expect(contrast(v("--state-held-ink"), v("--state-held"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps text readable on the selection and highlight washes", () => {
    for (const wash of ["--selection", "--state-highlight-wash"]) {
      expect(contrast(v("--text-primary"), v(wash)), wash).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("never puts lime on focus, text or state", () => {
    const lime = v("--ch-lime").toLowerCase();
    const jobs = [...t].filter(([name]) =>
      /focus|text|state|selection|highlight|here-rule|hand-ink|wrap-mark|icon-ink/.test(name),
    );
    expect(jobs.length).toBeGreaterThan(10);
    for (const [name, value] of jobs) expect(value.toLowerCase(), name).not.toBe(lime);
  });

  it("uses lime only for live and the link underline", () => {
    const lime = v("--ch-lime").toLowerCase();
    const limeTokens = [...t]
      .filter(([, value]) => value.toLowerCase() === lime)
      .map(([name]) => name)
      .sort();
    expect(limeTokens).toEqual([
      "--action-secondary-underline",
      "--ask-live",
      "--ch-lime",
      "--hand-live",
      "--live",
    ]);
  });

  it("is not imported by the app yet; only Storybook reads it until PR2", () => {
    const readers = sourceFiles("src")
      .filter((path) => /\.(css|tsx?)$/.test(path) && !path.includes("__tests__"))
      .filter((path) => readFileSync(path, "utf8").includes("skins/charlotte.css"));
    expect(readers).toEqual([]);
  });
});
