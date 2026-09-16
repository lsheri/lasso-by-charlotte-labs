import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveMotion } from "@/lib/motion-registry";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("pass E2 - Find it, entry points and motion", () => {
  it("registers the four find it motions with a reduced answer", () => {
    for (const event of [
      "findit.reading",
      "findit.found",
      "findit.kept",
      "findit.search_landed",
    ] as const) {
      const moving = resolveMotion(event, false);
      const still = resolveMotion(event, true);
      expect(moving.motion).toBeTruthy();
      expect(still.reduced.length).toBeGreaterThan(0);
    }
  });

  it("keeps the five auditability motions as a promise", () => {
    for (const event of [
      "record.reading",
      "verify.reading",
      "verify.flagged",
      "provenance.tracing",
      "provenance.shown",
    ] as const) {
      expect(resolveMotion(event, false).promise).toBe(true);
    }
  });

  it("accepts a target and an entry in the route search", () => {
    const route = read("src/routes/_authenticated/find-it.tsx");
    expect(route).toContain("validateSearch");
    expect(route).toContain("target");
    expect(route).toContain("entry");
  });

  it("keeps the peek's original button text", () => {
    const whatFedThis = read("src/components/peek/WhatFedThis.tsx");
    expect(whatFedThis).toContain("const findButton = canEdit ? (");
    expect(whatFedThis).toContain("FindItLink");
  });

  it("uses percentage positions rather than measuring the canvas", () => {
    const results = read("src/components/find-it/FindItResults.tsx");
    expect(results).toContain('["--x" as string]');
    expect(results).toContain('["--y" as string]');
    expect(results).not.toContain("getBoundingClientRect");
  });
});
