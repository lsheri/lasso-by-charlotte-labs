import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pass 186: the student's transparency page", () => {
  const page = read("src/pages/AffiliationPage.tsx");

  it("carries the exact lines", () => {
    expect(page).toContain("Counts, never content.");
    expect(page).toContain("None of this leaves your account.");
    expect(page).toContain("your record is yours, and it leaves with you");
  });

  // Each word asserted on its own so a failure names which one leaked.
  it.each(["monitor", "track", "score", "surveillance", "compliance", "telemetry", "analytics"])(
    "never uses the word %s",
    (word) => {
      expect(page.toLowerCase()).not.toContain(word);
    },
  );

  it("renders the empty share state without a share action", () => {
    expect(page).toMatch(/have not|has not/);
    expect(page).not.toMatch(/<Button[^>]*>\s*Share/);
  });

  it("the nav gains the item only through the hook", () => {
    const nav = read("src/components/layout/SidebarNav.tsx");
    expect(nav).toContain("useAffiliation");
    expect(nav).toContain("sees");
  });

  it("registers the event, dims only", () => {
    expect(read("src/lib/telemetry-shared.ts")).toContain('| "affiliation.disclosure_read"');
    const fns = read("src/lib/affiliation.functions.ts");
    expect(fns).toContain("affiliation.disclosure_read");
    expect(fns).not.toContain("payload");
  });
});
