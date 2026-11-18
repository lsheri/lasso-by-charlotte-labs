// G10 (17 Nov 2026): the reference components in src/design/reference are the source of truth (15 Oct) and the app
// copies their values. This keeps every reference token declared and stops the app copy drifting away from it.
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(p, "utf8");
const parity = JSON.parse(read("src/design/reference-parity.json")) as Record<
  string,
  string[] | string
>;

function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "__tests__" && full !== path.join("src", "design")) sources(full, out);
    } else if (/\.(tsx?|css)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}
const app = sources("src").map(read).join("\n");
const declared = new Set(
  [
    "src/design/tokens.css",
    "src/styles.css",
    ...readdirSync("src/styles").map((f) => `src/styles/${f}`),
    "src/design/reference/TextFace.css",
    ...readdirSync("src/design/skins").map((f) => `src/design/skins/${f}`),
  ].flatMap((p) => [...read(p).matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] ?? "")),
);
/** Provided at runtime by Tailwind's theme, not declared in our CSS. */
const TAILWIND = new Set(["--text-sm"]);

describe("reference components", () => {
  for (const file of readdirSync("src/design/reference").filter((f) => f.endsWith(".tsx"))) {
    it(`${file} reads only declared tokens`, () => {
      const used = [
        ...read(`src/design/reference/${file}`).matchAll(/var\((--[a-z0-9-]*[a-z0-9])[,)]/g),
      ].map((m) => m[1] ?? "");
      const missing = used.filter((t) => !declared.has(t) && !TAILWIND.has(t));
      expect(missing, `${file} reads tokens nobody declares`).toEqual([]);
    });
  }

  for (const [name, tokens] of Object.entries(parity)) {
    if (name.startsWith("_") || typeof tokens === "string") continue;
    it(`the app copy of ${name} still reads its ${tokens.length} shared tokens`, () => {
      const dropped = tokens.filter((t) => !app.includes(`var(${t}`));
      expect(
        dropped,
        `the app stopped reading these ${name} tokens; it has drifted from src/design/reference/${name}.tsx`,
      ).toEqual([]);
    });
  }
});
