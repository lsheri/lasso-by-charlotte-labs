// P2b and PR4: Charlotte glyphs match the 13 Nov spec, cover every GraphiteIconName, and reach the app only through GraphiteIcon.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ICON_NAMES } from "@/components/notebook/icons";
import { CHARLOTTE_GLYPHS, type ExhibitPath } from "@/design/icons/charlotte";
import { CHARLOTTE_EXTRA_GLYPHS, CHARLOTTE_EXTRA_NAMES } from "@/design/icons/charlotte-extra";
import { CHARLOTTE_KINDS, KIND_FAMILIES } from "@/design/icons/charlotte-kinds";

// The spec's helpers, verbatim.
const RR = (x: number, y: number, w: number, h: number, r: number) =>
  `M${x + r} ${y}h${w - 2 * r}a${r} ${r} 0 0 1 ${r} ${r}v${h - 2 * r}a${r} ${r} 0 0 1 -${r} ${r}h-${w - 2 * r}a${r} ${r} 0 0 1 -${r} -${r}v-${h - 2 * r}a${r} ${r} 0 0 1 ${r} -${r}z`;
const DOT = (x: number, y: number, r: number) =>
  `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 -${2 * r} 0z`;

/** Every RR and DOT call in the spec, by glyph and path index. */
const BOARD = RR(3, 3.5, 14, 13, 1.5);
const PRECOMPUTED: [readonly ExhibitPath[], number, string][] = [
  [CHARLOTTE_GLYPHS.engagement, 0, BOARD],
  [CHARLOTTE_GLYPHS.workboard, 0, BOARD],
  [CHARLOTTE_GLYPHS.members, 0, DOT(7.5, 6.5, 2.75)],
  [CHARLOTTE_GLYPHS.settings, 1, DOT(12, 6.5, 2)],
  [CHARLOTTE_GLYPHS.settings, 2, DOT(8, 13.5, 2)],
  [CHARLOTTE_GLYPHS.analyses, 1, DOT(6.75, 7.75, 3.5)],
  [CHARLOTTE_GLYPHS.search, 0, DOT(8.75, 8.75, 4.75)],
  [CHARLOTTE_GLYPHS.workstreams, 0, BOARD],
  [CHARLOTTE_GLYPHS["preview-cards"], 1, DOT(10, 10, 2.5)],
  [CHARLOTTE_GLYPHS["working-from"], 0, RR(4.5, 3, 11, 14, 1)],
  [CHARLOTTE_GLYPHS.share, 1, DOT(5, 10, 2.25)],
  [CHARLOTTE_GLYPHS.share, 2, DOT(15, 5, 2.25)],
  [CHARLOTTE_GLYPHS.share, 3, DOT(15, 15, 2.25)],
  [CHARLOTTE_GLYPHS.workstream, 0, BOARD],
  [CHARLOTTE_GLYPHS.workstream, 1, DOT(6.75, 7.5, 1.1)],
  [CHARLOTTE_GLYPHS.workstream, 2, DOT(13.25, 7.5, 1.1)],
  [CHARLOTTE_GLYPHS.workstream, 3, DOT(10, 12.75, 1.1)],
  [CHARLOTTE_GLYPHS["draw-workstream"], 0, RR(5, 3, 10, 14, 1.5)],
  [CHARLOTTE_EXTRA_GLYPHS.lock, 0, RR(4.5, 9, 11, 8, 1)],
  [CHARLOTTE_EXTRA_GLYPHS.info, 0, DOT(10, 10, 7)],
  [CHARLOTTE_KINDS[3]!.d, 0, RR(2.75, 4.5, 14.5, 11, 1)],
  [CHARLOTTE_KINDS[5]!.d, 0, RR(4.5, 3, 11, 14, 1)],
  [CHARLOTTE_KINDS[7]!.d, 0, BOARD],
  [CHARLOTTE_KINDS[8]!.d, 0, BOARD],
  [CHARLOTTE_KINDS[8]!.d, 2, DOT(13.25, 7, 1.25)],
];

const text = (p: ExhibitPath) => (typeof p === "string" ? p : p.d);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : [path];
  });
}

describe("Charlotte glyphs", () => {
  it("has a Charlotte glyph for every GraphiteIconName, and no others", () => {
    expect(Object.keys(CHARLOTTE_GLYPHS).sort()).toEqual([...ICON_NAMES].sort());
    expect(ICON_NAMES).toHaveLength(42);
  });

  it("matches the spec's RR and DOT formulas wherever it used them", () => {
    for (const [paths, i, expected] of PRECOMPUTED) expect(text(paths[i]!)).toBe(expected);
  });

  it("marks only the section outline as dashed, as data", () => {
    const dashed = Object.entries(CHARLOTTE_GLYPHS).flatMap(([name, paths]) =>
      paths.filter((p) => typeof p !== "string").map(() => name),
    );
    expect(dashed).toEqual(["section"]);
    expect(CHARLOTTE_GLYPHS.section[0]).toEqual({ d: RR(3, 4.5, 14, 11, 1), dashed: true });
    const all = [
      ...Object.values(CHARLOTTE_GLYPHS),
      ...Object.values(CHARLOTTE_EXTRA_GLYPHS),
      ...CHARLOTTE_KINDS.map((k) => k.d),
    ].flat();
    for (const p of all) expect(text(p)).not.toMatch(/^~/);
  });

  it("keeps the 10 extras out of the shared names", () => {
    expect(CHARLOTTE_EXTRA_NAMES).toHaveLength(10);
    expect(Object.keys(CHARLOTTE_EXTRA_GLYPHS).sort()).toEqual([...CHARLOTTE_EXTRA_NAMES].sort());
    for (const name of CHARLOTTE_EXTRA_NAMES) expect(ICON_NAMES).not.toContain(name);
  });

  it("has 12 kinds across all 6 families", () => {
    expect(CHARLOTTE_KINDS).toHaveLength(12);
    expect(new Set(CHARLOTTE_KINDS.map((k) => k.family))).toEqual(
      new Set(Object.keys(KIND_FAMILIES)),
    );
    expect(Object.keys(KIND_FAMILIES)).toHaveLength(6);
  });

  it("reaches the app only through GraphiteIcon (PR4); the extras and kinds stay out until their PRs", () => {
    const readers = sourceFiles("src")
      .filter((path) => /\.(css|tsx?)$/.test(path) && !path.startsWith("src/design/"))
      .filter((path) => !path.includes("__tests__"))
      .filter((path) => /design\/icons\//.test(readFileSync(path, "utf8")));
    expect(readers).toEqual(["src/components/notebook/icons.tsx"]);
    const icons = readFileSync("src/components/notebook/icons.tsx", "utf8");
    expect(icons).toContain('from "@/design/icons/charlotte"');
    expect(icons).not.toMatch(/design\/icons\/(charlotte-extra|charlotte-kinds|ExhibitIcon)/);
  });
});
