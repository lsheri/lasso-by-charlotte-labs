import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

/**
 * The coach Ask tab is messages and nothing else. It must not reach for the
 * member Ask machinery, which carries history, analyses and scope pickers.
 */
describe("coach Ask stays a messages-only surface", () => {
  const coachFiles = walk("src/components/coaching");

  it("no coaching component imports the member Ask context or dock", () => {
    const offenders = coachFiles.filter((path) => {
      const source = readFileSync(path, "utf8");
      return (
        source.includes("ask-lasso-context") ||
        source.includes("use-ask-lasso") ||
        source.includes("ReflectDock") ||
        source.includes("AskSurface") ||
        source.includes("AskSheet\"")
      );
    });
    expect(offenders).toEqual([]);
  });

  it("the coach sheet exists and talks to the coach chat endpoint only", () => {
    const source = readFileSync("src/components/coaching/CoachAskSheet.tsx", "utf8");
    expect(source).toContain("/api/coach-chat/stream");
    expect(source).not.toContain("/api/reflect/stream");
    expect(source).not.toContain("/api/analysis/stream");
  });

  it("the coach tab bar offers Ask without the member Ask handler", () => {
    const source = readFileSync("src/components/layout/MobileTabBar.tsx", "utf8");
    expect(source).toContain('action: "coach-ask"');
    expect(source).toContain("CoachAskSheet");
  });
});
