import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import { markSignupSource, readSignupSource, clearSignupSource } from "../edu-entry";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pass 185: the front door is remembered", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as unknown as { window: unknown }).window = {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
        removeItem: (k: string) => void store.delete(k),
      },
    };
  });

  it("stores a known source and reads it back", () => {
    markSignupSource("ceiba_uni");
    expect(readSignupSource()).toBe("ceiba_uni");
    clearSignupSource();
    expect(readSignupSource()).toBeNull();
  });

  it("ignores an unrecognised source", () => {
    markSignupSource("nonsense");
    expect(readSignupSource()).toBeNull();
  });
});

describe("pass 185: sources", () => {
  it("edu-entry carries the source key and the clear", () => {
    const src = read("src/lib/edu-entry.ts");
    expect(src).toContain("lasso.signup_source");
    expect(src).toContain("clearSignupSource");
  });

  it("onboarding writes the column, not the settings blob", () => {
    const src = read("src/routes/onboarding.tsx");
    expect(src).toContain("signup_source");
    expect(src).toContain("org_affiliations");
    expect(src).not.toMatch(/settings[^\n]*signup_source/);
  });

  it("the stamp reads affiliation for real", () => {
    const src = read("src/lib/org-type.server.ts");
    expect(src).toContain("isAffiliatedStrict");
    expect(src).not.toContain("Affiliation does not exist yet");
  });

  it("the event is registered and carries nothing but a slug", () => {
    expect(read("src/lib/telemetry-shared.ts")).toContain('| "workspace.affiliated"');
    const fn = read("src/lib/affiliation.functions.ts");
    expect(fn).toContain("workspace.affiliated");
    expect(fn).not.toContain("payload");
  });
});
