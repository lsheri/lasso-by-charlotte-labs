// PR0: the screens canvas lays out every baseline surface at both widths, one column per skin.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { screensGrid } from "./stories/screens/screens-grid";

const BASELINE = "tests/e2e/__baseline__";

function committedPictures(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const skin of readdirSync(BASELINE, { withFileTypes: true }).filter((d) =>
    d.isDirectory(),
  )) {
    for (const viewport of readdirSync(join(BASELINE, skin.name))) {
      for (const file of readdirSync(join(BASELINE, skin.name, viewport))) {
        out[`${BASELINE}/${skin.name}/${viewport}/${file}`] = file;
      }
    }
  }
  return out;
}

describe("screens canvas", () => {
  it("has 26 slots per skin: 14 surfaces, one desktop only and one phone only", () => {
    const bands = screensGrid({});
    expect(bands.map((b) => b.viewport)).toEqual(["desktop-1280", "phone-375"]);
    expect(bands.map((b) => b.rows.length)).toEqual([13, 13]);
    expect(bands[0]?.rows.some((r) => r.surface.id === "14-mobile-tab-bar")).toBe(false);
    expect(bands[1]?.rows.some((r) => r.surface.id === "07-sidebar-open")).toBe(false);
  });

  it("shows Lasso beside Charlotte, with a pending cell wherever no picture exists", () => {
    const bands = screensGrid({});
    for (const row of bands.flatMap((b) => b.rows)) {
      expect(row.cells).toEqual([
        { skin: "lasso", src: null },
        { skin: "charlotte", src: null },
      ]);
    }
  });

  it("places the committed Lasso pictures: 8 found, 18 pending", () => {
    const cells = screensGrid(committedPictures()).flatMap((b) => b.rows.flatMap((r) => r.cells));
    const lasso = cells.filter((c) => c.skin === "lasso");
    expect(lasso.filter((c) => c.src !== null)).toHaveLength(8);
    expect(lasso.filter((c) => c.src === null)).toHaveLength(18);
  });

  it("adds a column for a new skin folder with no code change", () => {
    const bands = screensGrid({ "x/plum/phone-375/05-home.png": "home.png" });
    const home = bands[1]?.rows.find((r) => r.surface.id === "05-home");
    expect(home?.cells.map((c) => c.skin)).toEqual(["lasso", "charlotte", "plum"]);
    expect(home?.cells[2]?.src).toBe("home.png");
  });
});
