import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AFFILIATION_WINDOW_MS,
  institutionToRecord,
  withinAffiliationWindow,
} from "../affiliation.functions";
import * as affiliationModule from "../affiliation.functions";

// Guard: an affiliation must come from a redeemed activation key, never from
// a signup source. The cohort count behind org_affiliations is evidence an
// institutional invoice or pilot report rests on, so it must not be forgeable
// by anyone who simply arrived from a partner's front door.

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pass 216: the self-serve affiliation path is closed", () => {
  it("onboarding never references the affiliation function", () => {
    expect(read("src/routes/onboarding.tsx")).not.toContain("affiliateWorkspaceFn");
  });

  it("onboarding never touches org_affiliations", () => {
    expect(read("src/routes/onboarding.tsx")).not.toContain("org_affiliations");
  });

  it("the module no longer exports affiliateWorkspaceFn or noteAffiliatedFn", () => {
    expect("affiliateWorkspaceFn" in affiliationModule).toBe(false);
    expect("noteAffiliatedFn" in affiliationModule).toBe(false);
    expect(read("src/lib/affiliation.functions.ts")).not.toContain("affiliateWorkspaceFn");
    expect(read("src/lib/affiliation.functions.ts")).not.toContain("noteAffiliatedFn");
  });

  it("the helpers other modules import still export and behave as before", () => {
    expect(institutionToRecord("artemis")).toBe("artemis");
    expect(institutionToRecord("nonsense")).toBe("unknown");
    expect(institutionToRecord("")).toBeNull();
    expect(AFFILIATION_WINDOW_MS).toBe(3600000);
    const now = Date.now();
    expect(withinAffiliationWindow(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(withinAffiliationWindow(new Date(now - 61 * 60_000).toISOString(), now)).toBe(false);
    expect(withinAffiliationWindow(null, now)).toBe(false);
  });

  it("the workspace.affiliated event stays registered and allowlisted", () => {
    expect(read("src/lib/telemetry-shared.ts")).toContain('| "workspace.affiliated"');
    expect(read("src/lib/event-dim-allowlist.ts")).toContain("workspace.affiliated");
  });
});
