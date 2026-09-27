import { describe, expect, it } from "vitest";

import {
  AFFILIATION_WINDOW_MS,
  withinAffiliationWindow,
} from "@/lib/affiliation.functions";

const NOW = 1_790_000_000_000;

describe("withinAffiliationWindow", () => {
  it("accepts a timestamp one minute before now", () => {
    expect(withinAffiliationWindow(new Date(NOW - 60 * 1000).toISOString(), NOW)).toBe(true);
  });

  it("accepts a timestamp 59 minutes before now", () => {
    expect(withinAffiliationWindow(new Date(NOW - 59 * 60 * 1000).toISOString(), NOW)).toBe(true);
  });

  it("refuses a timestamp 61 minutes before now", () => {
    expect(withinAffiliationWindow(new Date(NOW - 61 * 60 * 1000).toISOString(), NOW)).toBe(false);
  });

  it("refuses absent and unparseable timestamps", () => {
    expect(withinAffiliationWindow(null, NOW)).toBe(false);
    expect(withinAffiliationWindow(undefined, NOW)).toBe(false);
    expect(withinAffiliationWindow("", NOW)).toBe(false);
    expect(withinAffiliationWindow("not a date", NOW)).toBe(false);
  });

  it("accepts a timestamp exactly equal to now", () => {
    expect(withinAffiliationWindow(new Date(NOW).toISOString(), NOW)).toBe(true);
  });
});

describe("AFFILIATION_WINDOW_MS", () => {
  it("is exactly one hour", () => {
    expect(AFFILIATION_WINDOW_MS).toBe(3600000);
  });
});
