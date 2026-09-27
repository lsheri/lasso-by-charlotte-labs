import { beforeEach, describe, expect, it } from "vitest";

import { PARTNER_SLUGS, isPartnerSlug } from "../partners";
import { markSignupSource, readSignupSource, clearSignupSource } from "../edu-entry";

describe("pass 204: the partner set", () => {
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

  it("lists exactly the three partners, in order", () => {
    expect([...PARTNER_SLUGS]).toEqual(["ceiba_uni", "artemis", "cabin_ai"]);
  });

  it("isPartnerSlug accepts the three and nothing else", () => {
    for (const slug of PARTNER_SLUGS) expect(isPartnerSlug(slug)).toBe(true);
    for (const bad of ["edu", "direct", "", null, undefined, 123, "Ceiba_Uni"]) {
      expect(isPartnerSlug(bad)).toBe(false);
    }
  });

  it("signup sources round-trip every partner plus edu and direct", () => {
    for (const source of ["ceiba_uni", "artemis", "cabin_ai", "edu", "direct"]) {
      clearSignupSource();
      markSignupSource(source);
      expect(readSignupSource()).toBe(source);
    }
  });

  it("an unrecognised source is still ignored", () => {
    clearSignupSource();
    markSignupSource("nonsense");
    expect(readSignupSource()).toBeNull();
  });

  it("every slug is a valid institutions.slug shape", () => {
    for (const slug of PARTNER_SLUGS) {
      expect(slug).toMatch(/^[a-z_]+$/);
      expect(slug).not.toContain(" ");
    }
  });
});
