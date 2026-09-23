import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { filterWorkstreams, insertWorkstream, slashQuery } from "../slash-menu";

describe("B3 slash menu", () => {
  it("opens only at the start of a word", () => {
    expect(slashQuery("/pri", 4)).toEqual({ query: "pri", start: 0 });
    expect(slashQuery("look at /Pri", 12)).toEqual({ query: "Pri", start: 8 });
    expect(slashQuery("and/or", 6)).toBeNull();
    expect(slashQuery("/Pricing done", 13)).toBeNull();
  });

  it("filters workstreams by name, ignoring case", () => {
    const ws = [{ id: "1", name: "Pricing" }, { id: "2", name: "Market sizing" }, { id: "3", name: "Ops" }];
    expect(filterWorkstreams(ws, "si").map((w) => w.id)).toEqual(["2"]);
    expect(filterWorkstreams(ws, "").length).toBe(3);
  });

  it("inserts the workstream name and a space", () => {
    expect(insertWorkstream("check /pri", 6, 10, "Pricing")).toBe("check /Pricing ");
  });

  it("keeps the @ sentence and adds the / hint", () => {
    const src = readFileSync(resolve(process.cwd(), "src/components/reflect/AskSurface.tsx"), "utf8");
    expect(src).toContain("Type @ to point at a piece of work. Type / for a workstream.");
  });
});
