// Phase 4 PR9: one switch flips the product from Lasso to Charlotte (Liam, 15 Nov 2026: "Build a flip switch, off").
// It ships off, so nothing anyone sees changes; on, Charlotte is the only brand and the server speaks as Charlotte.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { BRAND_FLIPPED, brandCopy, brandCopyDeep, launchBrand, makerLine } from "@/design/brand/brand";
import { BRANCH_NEEDS_SIGNIN } from "@/lib/branch-fetch";
import { earlierNameLine } from "@/lib/mcp-earlier-name";
import { MCP_SERVER_NAME } from "@/lib/mcp-setup-steps";
import { resolveSkin } from "@/lib/skin";

describe("the flip switch", () => {
  it("ships off", () => {
    expect(BRAND_FLIPPED).toBe(false);
    expect(launchBrand().name).toBe("Lasso");
  });

  it("off, the server's own names are exactly what pilots already see", () => {
    expect(MCP_SERVER_NAME).toBe("Lasso by Charlotte Labs");
    expect(BRANCH_NEEDS_SIGNIN).toBe(
      "Branches open through the signed-in Lasso connector. Connect Lasso by signing in, then try again.",
    );
  });

  it("on, the server speaks as Charlotte", () => {
    const flipped = launchBrand(true);
    expect(flipped.name).toBe("Charlotte");
    expect(makerLine(flipped)).toBe("Charlotte Labs");
    expect(brandCopy(flipped, "Saved to Lasso.")).toBe("Saved to Charlotte.");
  });

  it("on, Charlotte is the only skin, whatever was asked for and whoever is signed in", () => {
    for (const requested of ["lasso", "charlotte", null] as const) {
      for (const email of [null, "someone@example.com", "qa.company.admin@qaprobe.test"]) {
        expect(resolveSkin({ current: "lasso", requested, email, host: "lasso.charlotte-labs.com", flipped: true })).toBe(
          "charlotte",
        );
      }
    }
    expect(resolveSkin({ current: "lasso", requested: "charlotte", email: null, host: "lasso.charlotte-labs.com" })).toBe(
      "lasso",
    );
  });
});

describe("the connector's replies to the AI", () => {
  it("name the product only through PRODUCT, so the switch renames every one", () => {
    const code = readFileSync("src/lib/mcp-handler.server.ts", "utf8")
      .split("\n")
      .filter((line) => !/^\s*(\*|\/\/|\/\*\*)/.test(line));
    expect(code.filter((line) => /\bLasso\b/.test(line))).toEqual([]);
  });
});

describe("the earlier name after the flip (PR10)", () => {
  it("adds nothing before the flip", () => {
    expect(earlierNameLine(launchBrand().name)).toBe("");
  });

  it("keeps 'Push to Lasso' working once the push tool says Charlotte", () => {
    const product = launchBrand(true).name;
    // tools/list renames first, then adds the earlier-name line, so the rename cannot touch it.
    const renamed = brandCopyDeep(launchBrand(true), { description: "When the user says 'Push to Lasso', save it." });
    const description = `${earlierNameLine(product)}${renamed.description}`;
    expect(description).toContain("'Push to Charlotte'");
    expect(description).toContain("'Push to Lasso'");
    expect(description).toContain("Lasso was Charlotte's earlier name");
  });
});
