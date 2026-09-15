import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { PERF_NAMES } from "@/lib/perf-timing";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

const page = read("src/pages/FindItPage.tsx");

describe("pass E1 - Find it, real engines", () => {
  it("pins the four event names", () => {
    for (const name of [
      "findit.opened",
      "findit.run",
      "findit.searched",
      "findit.quote_shown",
    ]) {
      expect(page).toContain(`"${name}"`);
      expect(read("src/lib/telemetry-shared.ts")).toContain(`"${name}"`);
    }
  });

  it("reviews links on the find it surface", () => {
    expect(page).toContain('surface: "find_it"');
  });

  it("has no placeholder scorer left", () => {
    expect(existsSync(join(process.cwd(), "src/lib/find-it.ts"))).toBe(false);
  });

  it("shows no score and no percentage", () => {
    expect(page).not.toContain("score");
    expect(page).not.toContain("%");
  });

  it("times the run under a registered name", () => {
    expect(PERF_NAMES).toContain("findit.run");
  });

  it("keeps the quote out of the database", () => {
    const server = read("src/lib/find-it.functions.ts");
    expect(server).toContain("sharedSentenceFor");
    // The sentence is recomputed per read; nothing writes it to a link row.
    expect(server).not.toMatch(/work_item_links[\s\S]{0,200}(insert|update|upsert)/);
  });
});
