// A1 (17 Nov 2026): Lasso's text tokens pass WCAG 1.4.3 (4.5:1) on every surface, muted text included.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/design/tokens.css", "utf8");

/** Every --name:value in tokens.css, with var(--x) resolved inside the file. */
function tokens(): Map<string, string> {
  const raw = new Map<string, string>();
  for (const m of css.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g))
    if (!raw.has(m[1] ?? "")) raw.set(m[1] ?? "", (m[2] ?? "").trim());
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

const t = tokens();
const v = (name: string) => {
  const value = t.get(name);
  expect(value, name).toMatch(/^#[0-9a-fA-F]{6}$/);
  return value ?? "";
};

describe("Lasso text contrast", () => {
  it("keeps primary, secondary and muted text at 4.5:1 or better on page, raised, sunk and sunk-2", () => {
    for (const surface of [
      "--surface-page",
      "--surface-raised",
      "--surface-sunk",
      "--surface-sunk-2",
    ]) {
      for (const text of ["--text-primary", "--text-secondary", "--text-muted"]) {
        expect(contrast(v(text), v(surface)), `${text} on ${surface}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("leaves the pencil step of the ramp where it was, so sketches do not shift", () => {
    expect(t.get("--neutral-50")).toBe("#8f8f8a");
  });
});
