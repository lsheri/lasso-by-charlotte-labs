import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const CASES = [
  ["src/routes/personal.tsx", "/personal", "/"],
  ["src/routes/next.tsx", "/next", "/"],
  ["src/routes/landing-classic.tsx", "/landing-classic", "/"],
  ["src/routes/demo.classic.tsx", "/demo/classic", "/demo"],
] as const;

describe("R1 retired public pages", () => {
  for (const [file, path, target] of CASES) {
    it(`${path} redirects to ${target}`, () => {
      const src = readFileSync(file, "utf8");
      expect(src).toContain(`createFileRoute("${path}")`);
      expect(src).toContain(`throw redirect({ to: "${target}", replace: true })`);
      expect(src).not.toContain("landing.viewed");
    });
  }

  it("deletes the archived landing route", () => {
    expect(existsSync("src/routes/landing-archive.2026-09-25.tsx")).toBe(false);
  });

  it("gates internal pages to founder-org admins", () => {
    for (const file of ["design.icons.tsx", "motion.tsx", "qa.seed.tsx"]) {
      const src = readFileSync(`src/routes/_authenticated/${file}`, "utf8");
      expect(src).toContain('profile?.role === "admin" && profile?.org_id === QA_SEED_ORG_ID');
      expect(src).toContain('<Navigate to="/home" replace />');
    }
  });
});
